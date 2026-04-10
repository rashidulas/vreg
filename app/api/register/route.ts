import { chromium } from "playwright-core";
import chromiumBinary from "@sparticuz/chromium";
import { CarDetails } from "@/lib/types";
import { properties } from "@/lib/properties";

export const maxDuration = 60;

async function launchBrowser() {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // In dev, use locally installed Playwright browsers
    return chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    });
  }

  // In production (Vercel/serverless), use @sparticuz/chromium
  const executablePath = await chromiumBinary.executablePath();
  return chromium.launch({
    executablePath,
    headless: true,
    args: chromiumBinary.args,
  });
}

export async function POST(request: Request) {
  let browser;

  try {
    const body = await request.json();
    const { propertyId, carDetails } = body as {
      propertyId: string;
      carDetails: CarDetails;
    };

    const property = properties.find((p) => p.id === propertyId);
    if (!property) {
      return Response.json(
        { success: false, message: "Property not found", property: "", timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    if (!property.urlKey) {
      return Response.json(
        { success: false, message: `No URL key configured for ${property.name}`, property: property.name, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
    page.setDefaultTimeout(15000);

    const url = `https://www.register2park.com/register?key=${property.urlKey}`;
    await page.goto(url, { waitUntil: "networkidle" });

    // Dismiss the "Review Guest Parking Rules" overlay by clicking Continue
    async function dismissRulesOverlay() {
      try {
        const btn = page.getByRole("button", { name: "Continue" });
        await btn.waitFor({ state: "visible", timeout: 5000 });
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        await page.waitForTimeout(1500);
        return true;
      } catch {
        return false;
      }
    }

    await dismissRulesOverlay();

    // Click "Visitor Parking"
    const visitorBtn = page.getByRole("button", { name: "Visitor Parking" });
    await visitorBtn.waitFor({ state: "visible", timeout: 10000 });
    await visitorBtn.click();
    await page.waitForTimeout(2000);

    // Some properties show rules after clicking Visitor Parking
    await dismissRulesOverlay();

    // Wait for the form fields to appear
    const aptField = page.getByRole("textbox", { name: "Apartment Number:" });
    await aptField.waitFor({ state: "visible", timeout: 10000 });

    // Fill the form — use the property-specific apt number
    await aptField.fill(property.aptNumber);
    await page.getByRole("textbox", { name: "Make:" }).fill(carDetails.make);
    await page.getByRole("textbox", { name: "Model:" }).fill(carDetails.model);
    await page.getByRole("textbox", { name: "License Plate:", exact: true }).fill(carDetails.licensePlate);
    await page.getByRole("textbox", { name: "Confirm License Plate:" }).fill(carDetails.licensePlate);

    // Submit the form
    const nextBtn = page.getByRole("button", { name: "Next" });
    await nextBtn.scrollIntoViewIfNeeded();
    await nextBtn.click();
    await page.waitForTimeout(1000);

    try {
      await aptField.waitFor({ state: "hidden", timeout: 20000 });
    } catch {
      await browser.close();
      browser = undefined;
      return Response.json({
        success: false,
        message: `Form submission timed out at ${property.name}. The site may be experiencing issues.`,
        property: property.name,
        timestamp: new Date().toISOString(),
      });
    }

    await page.waitForTimeout(2000);
    const pageContent = await page.textContent("body");
    const isApproved = pageContent?.includes("Approved") || pageContent?.includes("approved");

    // Extract confirmation code
    let confirmationCode = "";
    const codeHeading = page.getByRole("heading", { level: 3 }).first();
    if (await codeHeading.isVisible().catch(() => false)) {
      const codeText = await codeHeading.textContent();
      if (codeText && /^[A-Z0-9]+$/.test(codeText.trim())) {
        confirmationCode = codeText.trim();
      }
    }

    if (!isApproved) {
      await browser.close();
      browser = undefined;
      return Response.json({
        success: false,
        message: `Registration was not approved at ${property.name}. Check the site manually.`,
        property: property.name,
        timestamp: new Date().toISOString(),
      });
    }

    // Handle email confirmation
    let emailSent = false;
    if (carDetails.email) {
      const emailBtn = page.getByRole("button", { name: "E-Mail Confirmation" });
      if (await emailBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await emailBtn.click();

        const emailField = page.getByRole("textbox", { name: "Email Address" });
        await emailField.waitFor({ state: "visible", timeout: 5000 });
        await emailField.fill(carDetails.email);

        // Accept the native alert ("Email confirmation has been sent.") that fires after Send
        page.once("dialog", (dialog) => dialog.accept());

        const sendBtn = page.getByRole("button", { name: "Send" });
        await sendBtn.click();
        await page.waitForTimeout(2000);
        emailSent = true;
      }
    }

    await browser.close();
    browser = undefined;

    const emailNote = emailSent ? ` Confirmation emailed to ${carDetails.email}.` : "";
    return Response.json({
      success: true,
      message: `Vehicle registered at ${property.name}.${emailNote}`,
      property: property.name,
      timestamp: new Date().toISOString(),
      confirmationCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return Response.json(
      { success: false, message, property: "", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
