import {init} from './core'
import {HiveClient} from '../utils'
import { PrivateKey } from '@hiveio/dhive'
import { JoinContract } from '../types/transactions'
import Axios from 'axios'
import { TransactionPoolService } from '../services/transactionPool'

void (async () => {
    
    const contract_id = process.argv[2]

    // sample usage
    // npx ts-node-dev src/transactions/leaveContract.ts 351d68f85ab150c71e577ae4ab406eacb6fb4b2a

    // pla: note - currently requires a node to be running as it accesses an api endpoint to receive the node id
    
    if(!contract_id) {
        console.log('Usage: leaveContract.ts <contract id>')
        process.exit(0)
    }
    const setup: {identity, config, ipfsClient} = await init()

    await TransactionPoolService.leaveContract({
            contract_id: contract_id
        },
        setup);
    
    process.exit(0)
})()