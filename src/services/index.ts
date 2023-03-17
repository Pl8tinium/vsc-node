import * as IPFS from "ipfs-http-client";
import { CID, IPFSHTTPClient } from "ipfs-http-client";
import Path from 'path'
import os from 'os'
import Crypto from 'crypto'
import { Config } from "./nodeConfig";
import { Ed25519Provider } from "key-did-provider-ed25519";
import { DID } from "dids";
import KeyResolver from 'key-did-resolver'
import { TransactionPoolService } from "./transactionPool";
import { mongo } from "./db";
import { Db } from "mongodb";
import { ChainBridge } from "./chainBridge";
import { ContractEngine } from "./contractEngine";
import { P2PService } from "./pubsub";
import { ContractWorker } from "./contractWorker";
import winston from "winston";
import getLogger from "../logger";

interface CoreOptions {
    pathSuffix?: string
    dbSuffix?: string
    ipfsApi?: string
    debugHelper?: {
        nodePublicAdresses?: Array<string>
    }
}

export class CoreService {
    ipfs: IPFSHTTPClient;
    config: Config;
    identity: DID;
    wallet: DID;
    transactionPool: TransactionPoolService;
    db: Db;
    chainBridge: ChainBridge;
    contractEngine: ContractEngine;
    options: CoreOptions;
    p2pService: P2PService;
    contractWorker: ContractWorker;
    logger: winston.Logger;

    constructor(options?: CoreOptions, logger?: winston.Logger) {
        this.options = options || {};
        this.logger = logger || getLogger('core')

        if(!this.options.ipfsApi) {
            this.options.ipfsApi = "/ip4/127.0.0.1/tcp/5001"
        }
        if(!this.options.debugHelper) {
            this.options.debugHelper = {}
            if (!this.options.debugHelper.nodePublicAdresses) {
                this.options.debugHelper.nodePublicAdresses = []
            }
        }
    }

    private async setupKeys() {
        for(let key of ['node', 'wallet']) {
            let privateKey = null
            if (this.config.get(`identity.${key}Private`)) {
              privateKey = Buffer.from(this.config.get(`identity.${key}Private`), 'base64')
            } else {
              privateKey = Crypto.randomBytes(32)
              const hex = privateKey.toString('base64')
              this.config.set(`identity.${key}Private`, hex)
            }
            const keyPrivate = new Ed25519Provider(privateKey)
            const did = new DID({ provider: keyPrivate, resolver: KeyResolver.getResolver() })
            await did.authenticate()
            this.config.set(`identity.${key}Public`, did.id)
            if(key === "node") {
                this.identity = did
            }
            if(key === "wallet") {
                this.wallet = did;
            }
        }
    }

    async start() {
        this.ipfs = IPFS.create({url: "/ip4/127.0.0.1/tcp/5001"});
        const homeDir = this.options.pathSuffix ? Path.join(os.homedir(), '.vsc-node-' + this.options.pathSuffix) : Path.join(os.homedir(), '.vsc-node')
        this.config = new Config(homeDir)
        await this.config.open()
        this.db = this.options.dbSuffix ? mongo.db('vsc-' + this.options.dbSuffix) : mongo.db('vsc')
        await mongo.connect()
        await this.setupKeys();

        try 
        {
            this.transactionPool = new TransactionPoolService(this)
            await this.transactionPool.start()
            
            this.chainBridge = new ChainBridge(this)
            await this.chainBridge.start();
    
            this.contractEngine = new ContractEngine(this)
            await this.contractEngine.start()
            
            this.contractWorker = new ContractWorker(this)
            await this.contractWorker.start()

            this.p2pService = new P2PService(this)
            await this.p2pService.start()
        }
        catch (err) {
            console.trace(err)
        }
    }
}