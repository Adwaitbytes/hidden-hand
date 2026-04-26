use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("J4f7bbpnNA4nssLeACL9uB6xvBdvhrND8vgabE97HoYG");

pub const AUCTION_SEED: &[u8] = b"auction";
pub const MAX_BIDS: usize = 8;

#[ephemeral]
#[program]
pub mod hidden_hand {
    use super::*;

    /// Initialize an auction PDA on the Solana base layer.
    pub fn init_auction(
        ctx: Context<InitAuction>,
        auction_id: [u8; 8],
        item_hash: [u8; 32],
    ) -> Result<()> {
        let auction = &mut ctx.accounts.auction;
        auction.auction_id = auction_id;
        auction.item_hash = item_hash;
        auction.authority = ctx.accounts.payer.key();
        auction.bids = Vec::new();
        auction.winner = None;
        auction.settled_amount = 0;
        auction.settled = false;
        msg!(
            "init_auction id={:?} pda={}",
            auction_id,
            auction.key()
        );
        Ok(())
    }

    /// Delegate the auction PDA to the MagicBlock ER.
    pub fn delegate_auction(
        ctx: Context<DelegateAuction>,
        auction_id: [u8; 8],
    ) -> Result<()> {
        ctx.accounts.delegate_auction(
            &ctx.accounts.payer,
            &[AUCTION_SEED, &auction_id],
            DelegateConfig {
                commit_frequency_ms: 600_000,
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
            },
        )?;
        Ok(())
    }

    /// Submit a sealed (encrypted) bid. Runs on the ER once delegated.
    /// We hash the encrypted blob and store (bidder, hash) in the auction.
    pub fn submit_sealed_bid(
        ctx: Context<SubmitSealedBid>,
        encrypted_blob: Vec<u8>,
    ) -> Result<()> {
        let auction = &mut ctx.accounts.auction;
        require!(!auction.settled, HiddenHandError::AlreadySettled);
        require!(
            auction.bids.len() < MAX_BIDS,
            HiddenHandError::BidCapReached
        );
        require!(
            !encrypted_blob.is_empty() && encrypted_blob.len() <= 512,
            HiddenHandError::InvalidBidBlob
        );

        // Hash the blob with the bidder pubkey for tamper resistance.
        let bidder = ctx.accounts.bidder.key();
        let mut hasher_input = Vec::with_capacity(32 + encrypted_blob.len());
        hasher_input.extend_from_slice(&bidder.to_bytes());
        hasher_input.extend_from_slice(&encrypted_blob);
        let hash = anchor_lang::solana_program::hash::hash(&hasher_input).to_bytes();

        auction.bids.push(SealedBid { bidder, hash });
        msg!(
            "sealed bid {} of {} on auction {}",
            auction.bids.len(),
            MAX_BIDS,
            auction.key()
        );
        Ok(())
    }

    /// Reveal the winner + amount. Commits state and undelegates back to base layer.
    pub fn reveal_and_settle(
        ctx: Context<RevealAndSettle>,
        winner: Pubkey,
        amount: u64,
    ) -> Result<()> {
        let auction = &mut ctx.accounts.auction;
        require!(!auction.settled, HiddenHandError::AlreadySettled);
        require_keys_eq!(
            ctx.accounts.payer.key(),
            auction.authority,
            HiddenHandError::Unauthorized
        );

        auction.winner = Some(winner);
        auction.settled_amount = amount;
        auction.settled = true;
        msg!(
            "settled auction {} winner={} amount={}",
            auction.key(),
            winner,
            amount
        );

        auction.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.auction.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(auction_id: [u8; 8])]
pub struct InitAuction<'info> {
    #[account(
        init,
        payer = payer,
        space = Auction::LEN,
        seeds = [AUCTION_SEED, &auction_id],
        bump,
    )]
    pub auction: Account<'info, Auction>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Delegate the auction PDA. The CHECK on the PDA is required by the SDK macro.
#[delegate]
#[derive(Accounts)]
#[instruction(auction_id: [u8; 8])]
pub struct DelegateAuction<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PDA derived from [AUCTION_SEED, auction_id] - the SDK macro takes over.
    #[account(mut, del, seeds = [AUCTION_SEED, &auction_id], bump)]
    pub pda: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct SubmitSealedBid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,
    #[account(mut)]
    pub auction: Account<'info, Auction>,
}

#[commit]
#[derive(Accounts)]
pub struct RevealAndSettle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub auction: Account<'info, Auction>,
}

#[account]
pub struct Auction {
    pub auction_id: [u8; 8],
    pub item_hash: [u8; 32],
    pub authority: Pubkey,
    pub bids: Vec<SealedBid>,
    pub winner: Option<Pubkey>,
    pub settled_amount: u64,
    pub settled: bool,
}

impl Auction {
    // 8 disc + 8 id + 32 hash + 32 authority + 4 vec_len + MAX_BIDS*(32+32) + 1 + 32 + 8 + 1
    pub const LEN: usize = 8 + 8 + 32 + 32 + 4 + (MAX_BIDS * (32 + 32)) + 1 + 32 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SealedBid {
    pub bidder: Pubkey,
    pub hash: [u8; 32],
}

#[error_code]
pub enum HiddenHandError {
    #[msg("Auction is already settled")]
    AlreadySettled,
    #[msg("Bid cap reached")]
    BidCapReached,
    #[msg("Invalid bid blob (empty or too large)")]
    InvalidBidBlob,
    #[msg("Unauthorized signer")]
    Unauthorized,
}
