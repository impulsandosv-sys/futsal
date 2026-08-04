import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []

// 1. Load app
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
console.log('1. Page loaded')

// 2. Login
await page.fill('input[type="password"]', 'futsal2024')
await page.click('button:has-text("Acceder")')
await page.waitForTimeout(2000)
const dashText = await page.textContent('body')
if (dashText.includes('Dashboard')) {
  console.log('2. Login OK - Dashboard visible')
} else {
  errors.push('Login failed - Dashboard not found')
}

// 3. Check for ReadinessTrafficLight
if (dashText.includes('Readiness Diaria')) {
  console.log('3. ReadinessTrafficLight visible')
} else {
  errors.push('ReadinessTrafficLight not found')
}

// 4. Check for Monotonía/Strain KPIs
if (dashText.includes('Monotonía') && dashText.includes('Strain')) {
  console.log('4. Monotonía/Strain KPIs visible')
} else {
  errors.push('Monotonía/Strain KPIs not found')
}

// 5. Navigate to Sessions page
await page.click('a:has-text("Sesiones")')
await page.waitForTimeout(1000)
const sessionsText = await page.textContent('body')
if (sessionsText.includes('Sesiones de Entrenamiento')) {
  console.log('5. SessionsPage loaded')
} else {
  errors.push('SessionsPage not found')
}
if (sessionsText.includes('RPE')) {
  console.log('6. RPE button visible on sessions')
} else {
  errors.push('RPE button not found')
}

// 6. Go to first player profile
await page.click('a:has-text("Jugadoras")')
await page.waitForTimeout(1000)
await page.click('a:has-text("Ana García")')
await page.waitForTimeout(1000)
const profileText = await page.textContent('body')
if (profileText.includes('Readiness')) {
  console.log('7. Readiness tab visible on PlayerProfile')
} else {
  errors.push('Readiness tab not found')
}

console.log('\n--- RESULTS ---')
if (errors.length === 0) {
  console.log('ALL CHECKS PASSED ✅')
} else {
  console.log(`FAILURES (${errors.length}):`)
  errors.forEach(e => console.log(`  ❌ ${e}`))
}

await browser.close()
process.exit(errors.length > 0 ? 1 : 0)
