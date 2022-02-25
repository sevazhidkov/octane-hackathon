import { Connection } from '@solana/web3.js';
import getConfig from './config';

export const connection = new Connection(getConfig().rpcUrl, 'confirmed');
