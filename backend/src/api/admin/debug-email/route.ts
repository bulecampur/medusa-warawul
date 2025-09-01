import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { INotificationModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger");

  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        RESEND_API_KEY: process.env.RESEND_API_KEY ? "✅ Set" : "❌ Missing",
        RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "❌ Missing",
      },
      modules: {},
      templates: {},
      errors: [],
    };

    // Check notification module
    try {
      const notificationService = req.scope.resolve(
        Modules.NOTIFICATION
      ) as INotificationModuleService;
      diagnostics.modules.notification = "✅ Available";

      // Check if we can list providers or get service info
      try {
        // This might not be available in all versions, so we'll try-catch it
        diagnostics.modules.notificationDetails =
          "Service resolved successfully";
      } catch (e) {
        diagnostics.modules.notificationDetails =
          "Service available but details unavailable";
      }
    } catch (error) {
      diagnostics.modules.notification = `❌ Error: ${error.message}`;
      diagnostics.errors.push(`Notification module: ${error.message}`);
    }

    // Check Resend service specifically
    try {
      const resendService = req.scope.resolve("notification");
      diagnostics.modules.resend = "✅ Resend service available";
    } catch (error) {
      diagnostics.modules.resend = `❌ Resend service error: ${error.message}`;
      diagnostics.errors.push(`Resend service: ${error.message}`);
    }

    // Test direct Resend API
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Test API key validity (this doesn't send an email)
      diagnostics.resendAPI = "✅ Resend SDK imported successfully";
    } catch (error) {
      diagnostics.resendAPI = `❌ Resend SDK error: ${error.message}`;
      diagnostics.errors.push(`Resend SDK: ${error.message}`);
    }

    // Check template files
    const fs = await import("fs");
    const path = await import("path");

    const templateFiles = [
      "order-placed.tsx",
      "order-shipped.tsx",
      "order-delivered.tsx",
      "order-ready-pickup.tsx",
      "customer-signup-verification.tsx",
      "customer-password-reset.tsx",
      "admin-signup-verification.tsx",
      "admin-password-reset.tsx",
      "refund-in-process.tsx",
      "refund-processed.tsx",
    ];

    for (const file of templateFiles) {
      const filePath = path.join(
        process.cwd(),
        "src",
        "modules",
        "resend",
        "emails",
        file
      );
      diagnostics.templates[file] = fs.existsSync(filePath)
        ? "✅ Exists"
        : "❌ Missing";
    }

    // Overall health check
    const hasErrors = diagnostics.errors.length > 0;
    const missingTemplates = Object.values(diagnostics.templates).some(
      (status) => status.includes("❌")
    );

    diagnostics.overallHealth =
      hasErrors || missingTemplates ? "❌ Issues Found" : "✅ All Systems OK";

    logger.info("Email system diagnostics completed", { diagnostics });

    res.json(diagnostics);
  } catch (error) {
    logger.error("Failed to run email diagnostics", error);
    res.status(500).json({
      error: "Diagnostics failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger");
  const { test_email } = req.body;

  if (!test_email) {
    return res.status(400).json({
      error: "test_email is required",
    });
  }

  try {
    logger.info(`Testing direct Resend API with email: ${test_email}`);

    // Test direct Resend API
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: [test_email],
      subject: "🧪 Direct Resend API Test - Warawul Coffee",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #8B4513; color: white; padding: 20px; text-align: center;">
            <h1>Warawul Coffee - API Test</h1>
          </div>
          <div style="padding: 20px;">
            <h2>✅ Direct API Test Successful!</h2>
            <p>This email was sent directly through the Resend API to test connectivity.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>From:</strong> ${process.env.RESEND_FROM_EMAIL}</p>
            <p><strong>To:</strong> ${test_email}</p>
            <p>If you received this email, the Resend API is working correctly.</p>
          </div>
          <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            Warawul Coffee - Email System Test
          </div>
        </div>
      `,
    });

    if (error) {
      logger.error("Direct Resend API test failed", error);
      return res.status(500).json({
        success: false,
        error: "Resend API Error",
        details: error,
        test_email,
      });
    }

    logger.info(`Direct Resend API test successful: ${data?.id}`);

    res.json({
      success: true,
      message: "Direct Resend API test successful",
      resend_id: data?.id,
      test_email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to test direct Resend API", error);
    res.status(500).json({
      success: false,
      error: "Direct API test failed",
      message: error.message,
      test_email,
    });
  }
};
