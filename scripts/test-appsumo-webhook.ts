import crypto from 'node:crypto'

// A pure Node script to test the AppSumo Webhook locally.
// Usage: npx tsx scripts/test-appsumo-webhook.ts <action> <tier>
// Actions: activate, enhance, reduce, refund
// Example: npx tsx scripts/test-appsumo-webhook.ts activate 1

const APPSUMO_API_KEY = process.env.APPSUMO_API_KEY || 'test_key_123'
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/appsumo/webhook'

async function sendWebhook(action: string, tier: number, licenseKey: string, prevLicenseKey?: string) {
  const payload = {
    action,
    license_key: licenseKey,
    tier,
    plan_id: `qlico_tier_${tier}`,
    activation_email: 'tester@example.com',
    invoice_item_uuid: crypto.randomUUID(),
    ...(prevLicenseKey ? { prev_license_key: prevLicenseKey } : {}),
  }

  const rawBody = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', APPSUMO_API_KEY).update(rawBody, 'utf8').digest('hex')

  console.log(`\n🚀 Firing '${action}' (Tier ${tier}) webhook to ${WEBHOOK_URL}...`)

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-appsumo-signature': signature,
      },
      body: rawBody,
    })

    const text = await res.text()
    if (!res.ok) {
      console.error(`❌ Webhook Failed [${res.status}]:`, text)
    } else {
      console.log(`✅ Webhook Succeeded [${res.status}]:`, text)
    }
  } catch (err) {
    console.error('❌ Connection failed. Is the Next.js server running on localhost:3000?')
  }
}

async function run() {
  const args = process.argv.slice(2)
  const action = args[0] || 'activate'
  const tier = parseInt(args[1] || '1', 10)
  
  if (!['activate', 'enhance', 'reduce', 'refund'].includes(action)) {
    console.error('Usage: npx tsx scripts/test-appsumo-webhook.ts [activate|enhance|reduce|refund] [tier]')
    process.exit(1)
  }

  const licenseKey = `qlico-test-${crypto.randomUUID().slice(0, 8)}`
  const prevLicenseKey = (action === 'enhance' || action === 'reduce') 
    ? 'qlico-test-prev-123' 
    : undefined

  await sendWebhook(action, tier, licenseKey, prevLicenseKey)
  
  console.log(`\n💡 Next steps to test redemption:`)
  console.log(`1. Copy the license key above: ${licenseKey}`)
  console.log(`2. Log into the app at http://localhost:3000/login`)
  console.log(`3. Go to http://localhost:3000/redeem and paste the key.`)
}

run()
