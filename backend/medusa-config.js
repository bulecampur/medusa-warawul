import { loadEnv, Modules, defineConfig } from "@medusajs/utils";
import {
  ADMIN_CORS,
  AUTH_CORS,
  BACKEND_URL,
  COOKIE_SECRET,
  DATABASE_URL,
  JWT_SECRET,
  REDIS_URL,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SHOULD_DISABLE_ADMIN,
  STORE_CORS,
  STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET,
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_ENVIRONMENT,
  POSTHOG_EVENTS_API_KEY,
  POSTHOG_HOST,
  KLAVIYO_API_KEY,
  GOOGLE_CALLBACK_URI,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  WORKER_MODE,
  MEILISEARCH_HOST,
  MEILISEARCH_ADMIN_KEY,
  LEXWARE_API_KEY,
} from "lib/constants";

loadEnv(process.env.NODE_ENV, process.cwd());

const medusaConfig = {
  projectConfig: {
    databaseUrl: DATABASE_URL,
    databaseLogging: false,
    redisUrl: REDIS_URL,
    workerMode: WORKER_MODE,
    http: {
      adminCors: ADMIN_CORS,
      authCors: AUTH_CORS,
      storeCors: STORE_CORS,
      jwtSecret: JWT_SECRET,
      cookieSecret: COOKIE_SECRET,
    },
    build: {
      rollupOptions: {
        external: ["@medusajs/dashboard"],
      },
    },
  },
  admin: {
    backendUrl: BACKEND_URL,
    disable: SHOULD_DISABLE_ADMIN,
  },
  modules: [
    {
      resolve: "./src/modules/invoice_generator",
    },
    ...(LEXWARE_API_KEY
      ? [
          {
            resolve: "./src/modules/lexoffice",
            options: {
              api_key: LEXWARE_API_KEY,
            },
          },
          {
            resolve: "./src/modules/product_sync",
          },
        ]
      : []),
    {
      key: Modules.ANALYTICS,
      resolve: "@medusajs/medusa/analytics",
      options: {
        providers: [
          ...(POSTHOG_EVENTS_API_KEY && POSTHOG_HOST
            ? [
                {
                  resolve: "@medusajs/analytics-posthog",
                  id: "posthog",
                  options: {
                    posthogEventsKey: process.env.POSTHOG_EVENTS_API_KEY,
                    posthogHost: process.env.POSTHOG_HOST,
                  },
                },
              ]
            : []),
        ],
      },
    },
    {
      key: Modules.FILE,
      resolve: "@medusajs/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              backend_url: `${BACKEND_URL}/static`,
            },
          },
        ],
      },
    },
    ...(REDIS_URL
      ? [
          {
            key: Modules.EVENT_BUS,
            resolve: "@medusajs/event-bus-redis",
            options: {
              redisUrl: REDIS_URL,
            },
          },
          {
            key: Modules.WORKFLOW_ENGINE,
            resolve: "@medusajs/workflow-engine-redis",
            options: {
              redis: {
                url: REDIS_URL,
              },
            },
          },
        ]
      : []),
    ...(RESEND_API_KEY && RESEND_FROM_EMAIL
      ? [
          {
            key: Modules.NOTIFICATION,
            resolve: "@medusajs/notification",
            options: {
              providers: [
                {
                  resolve: "./src/modules/resend",
                  id: "resend",
                  options: {
                    channels: ["email"],
                    api_key: RESEND_API_KEY,
                    from: RESEND_FROM_EMAIL,
                  },
                },
              ],
            },
          },
        ]
      : []),
    ...((STRIPE_API_KEY && STRIPE_WEBHOOK_SECRET) ||
    (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET && PAYPAL_ENVIRONMENT)
      ? [
          {
            key: Modules.PAYMENT,
            resolve: "@medusajs/payment",
            options: {
              providers: [
                ...(STRIPE_API_KEY && STRIPE_WEBHOOK_SECRET
                  ? [
                      {
                        resolve: "@medusajs/payment-stripe",
                        id: "stripe",
                        options: {
                          apiKey: STRIPE_API_KEY,
                          webhookSecret: STRIPE_WEBHOOK_SECRET,
                        },
                      },
                    ]
                  : []),
                ...(PAYPAL_CLIENT_ID &&
                PAYPAL_CLIENT_SECRET &&
                PAYPAL_ENVIRONMENT
                  ? [
                      {
                        resolve:
                          "@rsc-labs/medusa-paypal-payment/providers/paypal-payment",
                        id: "paypal-payment",
                        options: {
                          oAuthClientId: PAYPAL_CLIENT_ID,
                          oAuthClientSecret: PAYPAL_CLIENT_SECRET,
                          environment: PAYPAL_ENVIRONMENT,
                        },
                      },
                    ]
                  : []),
              ],
            },
          },
        ]
      : []),
  ],
  plugins: [
    {
      resolve: "@rsc-labs/medusa-store-analytics-v2",
      options: {},
    },
    ...(MEILISEARCH_HOST && MEILISEARCH_ADMIN_KEY
      ? [
          {
            resolve: "@rokmohar/medusa-plugin-meilisearch",
            options: {
              config: {
                host: MEILISEARCH_HOST,
                apiKey: MEILISEARCH_ADMIN_KEY,
              },
              settings: {
                products: {
                  type: "products",
                  enabled: true,
                  fields: [
                    "id",
                    "title",
                    "description",
                    "handle",
                    "variant_sku",
                    "thumbnail",
                  ],
                  indexSettings: {
                    searchableAttributes: [
                      "title",
                      "description",
                      "variant_sku",
                    ],
                    displayedAttributes: [
                      "id",
                      "handle",
                      "title",
                      "description",
                      "variant_sku",
                      "thumbnail",
                    ],
                    filterableAttributes: ["id", "handle"],
                  },
                  primaryKey: "id",
                },
              },
            },
          },
        ]
      : []),
  ],
};

console.log(JSON.stringify(medusaConfig, null, 2));
export default defineConfig(medusaConfig);
