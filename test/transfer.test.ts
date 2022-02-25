import { expect } from 'chai';
import { testApiHandler } from 'next-test-api-route-handler';
import {
    Keypair, PublicKey, Connection,
    Transaction, LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
    createMint, getOrCreateAssociatedTokenAccount, Account,
    mintTo, createTransferInstruction, createAccount, getAccount,
} from '@solana/spl-token';
import base58 from 'bs58';
import testConfig from './config.test.json';

const payerKeypair = Keypair.generate();
process.env.SECRET_KEY = base58.encode(payerKeypair.secretKey);
process.env.OCTANE_CONFIG_JSON = JSON.stringify(testConfig);

import transfer from '../pages/api/transfer';
import blockhash from '../pages/api/blockhash';

if (process.env.TEST_LIVE) {
  describe('Transfer endpoint', async () => {
      let connection: Connection;
      let tokenKeypair: Keypair;
      let mint: PublicKey;
      let tokenAccount: Account;
      before(async () => {
          connection = new Connection('http://localhost:8899/', 'confirmed');
          tokenKeypair = Keypair.generate();

          const airdropPublicKeys = [tokenKeypair.publicKey, payerKeypair.publicKey];
          for (const publicKey of airdropPublicKeys) {
              const airdropSignature = await connection.requestAirdrop(
                  publicKey,
                  LAMPORTS_PER_SOL,
              );
              await connection.confirmTransaction(airdropSignature);
          }

          mint = await createMint(connection, tokenKeypair, tokenKeypair.publicKey, null, 9);
          tokenAccount = await getOrCreateAssociatedTokenAccount(
              connection,
              tokenKeypair,
              mint,
              tokenKeypair.publicKey
          );
          testConfig['endpoints']['transfer']['tokens'][0]['mint'] = mint.toBase58();
          testConfig['endpoints']['transfer']['tokens'][0]['account'] = tokenAccount.address.toBase58();
          process.env.OCTANE_CONFIG_JSON = JSON.stringify(testConfig);
      });

      let sourceOwner: Keypair;
      let sourceAccount: PublicKey;
      let recentBlockhash: string = '';
      beforeEach(async () => {
          // We shouldn't airdrop any SOL to this keypair to prove fee paying works
          sourceOwner = Keypair.generate();
          sourceAccount = await createAccount(connection, payerKeypair, mint,sourceOwner.publicKey);
          await mintTo(connection, tokenKeypair, mint, sourceAccount, tokenKeypair.publicKey, 5000);
          await testApiHandler({
              handler: blockhash,
              test: async ({ fetch }) => {
                  const res = await fetch({ method: 'GET' });
                  expect(res.status).to.be.equals(200);
                  recentBlockhash = (await res.json())['blockhash']['blockhash'] as string;
                  expect(recentBlockhash).to.not.be.empty;
              }
          });
      });

      it('signs a transaction with token transfer to Octane payer successfully', async () => {
          const transaction = new Transaction();
          transaction.add(createTransferInstruction(sourceAccount, tokenAccount.address, sourceOwner.publicKey, 100));
          transaction.feePayer = payerKeypair.publicKey;
          transaction.recentBlockhash = recentBlockhash;
          transaction.partialSign(sourceOwner);

          await testApiHandler({
              handler: transfer,
              test: async ({ fetch }) => {
                  const res = await fetch({
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({
                          transaction: base58.encode(transaction.serialize({requireAllSignatures: false}))
                      })
                  });
                  expect(res.status).to.be.equals(200);
                  const signature = (await res.json())['signature'] as string;
                  expect(signature).to.not.be.empty;

                  expect((await connection.getSignatureStatus(signature)).value!.confirmationStatus).to.be.equals('confirmed');
                  expect((await getAccount(connection, sourceAccount, 'confirmed')).amount).to.equal(BigInt(4900));
                  expect((await getAccount(connection, tokenAccount.address, 'confirmed')).amount).to.equal(BigInt(100));
              }
          });
      });

      it('signs a transaction with token transfer and an arbitrary transfer to Octane payer successfully', async () => {
          const targetOwner = Keypair.generate();
          // We assume target account is already created.
          const targetAccount = await createAccount(connection, payerKeypair, mint, targetOwner.publicKey);

          const transaction = new Transaction();
          transaction.add(createTransferInstruction(sourceAccount, tokenAccount.address, sourceOwner.publicKey, 100));
          transaction.add(createTransferInstruction(sourceAccount, targetAccount, sourceOwner.publicKey, 100));
          transaction.feePayer = payerKeypair.publicKey;
          transaction.recentBlockhash = recentBlockhash;
          transaction.partialSign(sourceOwner);

          await testApiHandler({
              handler: transfer,
              test: async ({ fetch }) => {
                  const res = await fetch({
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({
                          transaction: base58.encode(transaction.serialize({requireAllSignatures: false}))
                      })
                  });
                  expect(res.status).to.be.equals(200);
                  const signature = (await res.json())['signature'] as string;
                  expect(signature).to.not.be.empty;

                  expect((await connection.getSignatureStatus(signature)).value!.confirmationStatus).to.be.equals('confirmed');
                  expect((await getAccount(connection, sourceAccount, 'confirmed')).amount).to.equal(BigInt(4800));
                  expect((await getAccount(connection, tokenAccount.address, 'confirmed')).amount).to.equal(BigInt(200));
                  expect((await getAccount(connection, targetAccount, 'confirmed')).amount).to.equal(BigInt(100));
              }
          });
      });

      it('rejects a duplicate transaction', async () => {
          const transaction = new Transaction();
          transaction.add(createTransferInstruction(sourceAccount, tokenAccount.address, sourceOwner.publicKey, 100));
          transaction.feePayer = payerKeypair.publicKey;
          transaction.recentBlockhash = recentBlockhash;
          transaction.partialSign(sourceOwner);
          await testApiHandler({
              handler: transfer,
              test: async ({ fetch }) => {
                  const res = await fetch({
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({
                          transaction: base58.encode(transaction.serialize({requireAllSignatures: false}))
                      })
                  });
                  expect(res.status).to.be.equals(200);
              }
          });
          await testApiHandler({
              handler: transfer,
              test: async ({ fetch }) => {
                  const res = await fetch({
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({
                          transaction: base58.encode(transaction.serialize({requireAllSignatures: false}))
                      })
                  });
                  expect(res.status).to.be.equals(500);
              }
          });
      })

      // test of fails
      // test with arbitrary program call
  });
}
