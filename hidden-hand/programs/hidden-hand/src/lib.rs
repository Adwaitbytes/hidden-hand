use anchor_lang::prelude::*;

declare_id!("JDVfwH96jA29RzDPPVRPuyjUFcXkZaDf4UJe5PFyvy7v");

#[program]
pub mod hidden_hand {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
