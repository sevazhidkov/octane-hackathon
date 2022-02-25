import type { NextApiRequest, NextApiResponse } from 'next';

// Writing a custom middleware is pretty hard on Next.js:
// https://github.com/vercel/next.js/discussions/17832
// Instead, we call this function when users encounter expected errors.
// In other cases, Next.js returns 500 (should be minimized).
// Rate limits should be handled separately and include retry logic.

export function handleError(request: NextApiRequest, response: NextApiResponse, message: string) {
    console.log('[error]', message);
    response.status(400).send({ status: 'error', message: message });
}
