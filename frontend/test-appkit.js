
import { AppKit } from '@circle-fin/app-kit';

async function checkBalance() {
  const address = '0x5AbC8a77CB6a174A6991aA62752cC4ad07AC517B';
  console.log(`🔍 Checking unified balance via AppKit for: ${address}`);

  const kit = new AppKit();
  
  try {
    const bal = await kit.unifiedBalance.getBalances({
      token: 'USDC',
      sources: { address: address },
      networkType: 'testnet',
      includePending: true
    });

    console.log('\n✅ AppKit Unified Balance Results:');
    console.log(`Total Confirmed: ${bal.totalConfirmedBalance} USDC`);
    console.log(`Total Pending: ${bal.totalPendingBalance || '0'} USDC`);
    
    console.log('\n📊 Breakdown:');
    if (bal.breakdown) {
      bal.breakdown.forEach(depositor => {
        console.log(`\nDepositor: ${depositor.depositor}`);
        depositor.breakdown.forEach(b => {
          console.log(`- ${b.chain}: ${b.confirmedBalance} ${b.symbol} (Status: ${b.status || 'unknown'})`);
        });
      });
    } else {
      console.log('No breakdown available');
    }

  } catch (error) {
    console.error('\n❌ Error fetching balance:', error);
  }
}

checkBalance();
