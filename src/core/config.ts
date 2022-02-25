import config from '../../config.json';

type Token = {
    mint: string;
    account: string;
    decimals: number;
    fee: number;
}

type Transfer = {
    tokens: Token[];
}

type Endpoints = {
    transfer: Transfer;
}

type Config = {
    rpcUrl: string;
    maxSignatures: number;
    lamportsPerSignature: number;
    corsOrigin: boolean;
    endpoints: Endpoints;
}

export default function getConfig(): Config {
    if (process.env['OCTANE_CONFIG_JSON']) {
        return JSON.parse(process.env['OCTANE_CONFIG_JSON']) as Config;
    }
    return config;
}
