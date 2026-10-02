<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c2b3d5a4-8ffb-4cca-a818-dd751ea2e6a3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## WhatsApp order alerts

The server now sends a WhatsApp notification to the configured Hotel Malabar admin number whenever a new order is successfully saved.

Configure these server environment variables in the hosting provider (do not put secrets in frontend code or GitHub):

- `WHATSAPP_ACCESS_TOKEN` — Meta WhatsApp Cloud API access token
- `WHATSAPP_PHONE_NUMBER_ID` — WhatsApp Business phone number ID
- `WHATSAPP_ADMIN_TO` — admin WhatsApp number in E.164 digits, e.g. `9198XXXXXXXX`
- `WHATSAPP_ORDER_TEMPLATE_NAME` — approved WhatsApp template name for business-initiated notifications
- `WHATSAPP_ORDER_TEMPLATE_LANG` — template language code, default `en_US`
- `WHATSAPP_API_VERSION` — optional Graph API version, default `v23.0`

For reliable new-order notifications outside an active WhatsApp conversation, use an approved Meta message template matching the six body parameters used by the server.
