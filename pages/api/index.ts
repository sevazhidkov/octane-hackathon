import type { NextApiRequest, NextApiResponse } from 'next';
import { ENV_FEE_PAYER, getConfig } from '../../src/core';
import { rateLimit, handleError } from '../../src/middleware';

const body = {
    feePayer: ENV_FEE_PAYER.toBase58(),
    ...getConfig(),
};

// Endpoint to get Octane's configuration
export default async function (request: NextApiRequest, response: NextApiResponse) {
    await rateLimit(request, response);

    response.status(200).send(body);
}
