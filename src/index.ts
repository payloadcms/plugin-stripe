import type { NextFunction, Response } from 'express'
import express from 'express'
import type { Config } from 'payload/config'
import type { PayloadRequest } from 'payload/types'

import { extendWebpackConfig } from './extendWebpackConfig'
import { createNewInStripe } from './hooks/createNewInStripe'
import { deleteFromStripe } from './hooks/deleteFromStripe'
import { syncExistingWithStripe } from './hooks/syncExistingWithStripe'
import { stripeREST } from './routes/rest'
import { stripeWebhooks } from './routes/webhooks'
import type { SanitizedStripeConfig, StripeConfig } from './types'
import { LinkToDoc } from './ui/LinkToDoc'

const stripePlugin =
  (incomingStripeConfig: StripeConfig) =>
  (config: Config): Config => {
    const { collections } = config

    // set config defaults here
    const stripeConfig: SanitizedStripeConfig = {
      ...incomingStripeConfig,
      // TODO: in the next major version, default this to `false`
      rest: incomingStripeConfig?.rest ?? true,
      sync: incomingStripeConfig?.sync || [],
    }

    // NOTE: env variables are never passed to the client, but we need to know if `stripeSecretKey` is a test key
    // unfortunately we must set the 'isTestKey' property on the config instead of using the following code:
    // const isTestKey = stripeConfig.stripeSecretKey?.startsWith('sk_test_');

    return {
      ...config,
      admin: {
        ...config.admin,
        webpack: extendWebpackConfig(config),
      },
      endpoints: [
        ...(config?.endpoints || []),
        {
          path: '/stripe/webhooks',
          method: 'post',
          root: true,
          handler: [
            express.raw({ type: 'application/json' }),
            (req, res, next) => {
              stripeWebhooks({
                req,
                res,
                next,
                config,
                stripeConfig,
              })
            },
          ],
        },
        ...(incomingStripeConfig?.rest
          ? [
              {
                path: '/stripe/rest',
                method: 'post',
                handler: (req: PayloadRequest, res: Response, next: NextFunction) => {
                  stripeREST({
                    req,
                    res,
                    next,
                    stripeConfig,
                  })
                },
              },
            ]
          : []),
      ],
      collections: collections?.map(collection => {
        const { hooks: existingHooks } = collection

        const syncConfig = stripeConfig.sync?.find(sync => sync.collection === collection.slug)

        if (syncConfig) {
          return {
            ...collection,
            hooks: {
              ...collection.hooks,
              beforeValidate: [
                ...(existingHooks?.beforeValidate || []),
                async args =>
                  createNewInStripe({
                    ...args,
                    collection,
                    stripeConfig,
                  }),
              ],
              beforeChange: [
                ...(existingHooks?.beforeChange || []),
                async args =>
                  syncExistingWithStripe({
                    ...args,
                    collection,
                    stripeConfig,
                  }),
              ],
              afterDelete: [
                ...(existingHooks?.afterDelete || []),
                async args =>
                  deleteFromStripe({
                    ...args,
                    collection,
                    stripeConfig,
                  }),
              ],
            },
            fields: [
              ...collection.fields,
              {
                name: 'stripeID',
                label: 'Stripe ID',
                type: 'text',
                saveToJWT: true,
                admin: {
                  position: 'sidebar',
                  readOnly: true,
                },
              },
              {
                name: 'skipSync',
                label: 'Skip Sync',
                type: 'checkbox',
                admin: {
                  position: 'sidebar',
                  readOnly: true,
                },
              },
              {
                name: 'docUrl',
                type: 'ui',
                admin: {
                  position: 'sidebar',
                  components: {
                    Field: args =>
                      LinkToDoc({
                        ...args,
                        isTestKey: stripeConfig.isTestKey,
                        stripeResourceType: syncConfig.stripeResourceType,
                        nameOfIDField: 'stripeID',
                      }),
                  },
                },
              },
            ],
          }
        }

        return collection
      }),
    }
  }

export default stripePlugin
