import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IUserModuleService, IAuthModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(`
      <html>
        <head>
          <title>Invalid Invite Link</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f9fafb; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .error { color: #dc2626; text-align: center; }
            h1 { color: #374151; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">
              <h1>❌ Invalid Invite Link</h1>
              <p>The invite link is missing a token parameter. Please check the link and try again.</p>
            </div>
          </div>
        </body>
      </html>
    `);
  }

  try {
    const userModuleService: IUserModuleService = req.scope.resolve(Modules.USER);
    
    // Retrieve all invites and find the one with matching token
    const invites = await userModuleService.listInvites();
    const invite = invites.find(inv => inv.token === token);
    
    if (!invite) {
      return res.status(404).send(`
        <html>
          <head>
            <title>Invite Not Found</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f9fafb; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
              .error { color: #dc2626; text-align: center; }
              h1 { color: #374151; margin-bottom: 16px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">
                <h1>🔍 Invite Not Found</h1>
                <p>The invite token is invalid or has expired. Please contact your administrator for a new invite.</p>
              </div>
            </div>
          </body>
        </html>
      `);
    }

    // Check if invite is already accepted
    if (invite.accepted) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Invite Already Accepted</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f9fafb; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
              .info { color: #059669; text-align: center; }
              h1 { color: #374151; margin-bottom: 16px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="info">
                <h1>✅ Invite Already Accepted</h1>
                <p>This invite has already been accepted. You can now log in to the admin dashboard.</p>
                <a href="/admin" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Go to Admin Dashboard</a>
              </div>
            </div>
          </body>
        </html>
      `);
    }

    // Display the invite acceptance form
    return res.send(`
      <html>
        <head>
          <title>Accept Admin Invite</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              margin: 0; 
              padding: 40px 20px; 
              background: #f9fafb; 
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container { 
              max-width: 500px; 
              width: 100%;
              background: white; 
              padding: 40px; 
              border-radius: 12px; 
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
            }
            h1 { 
              color: #374151; 
              margin-bottom: 8px;
              text-align: center;
            }
            .subtitle { 
              color: #6b7280; 
              text-align: center; 
              margin-bottom: 32px; 
            }
            .form-group { 
              margin-bottom: 20px; 
            }
            label { 
              display: block; 
              color: #374151; 
              font-weight: 600; 
              margin-bottom: 8px; 
            }
            input[type="email"], 
            input[type="password"], 
            input[type="text"] { 
              width: 100%; 
              padding: 12px 16px; 
              border: 1px solid #d1d5db; 
              border-radius: 8px; 
              font-size: 16px; 
              box-sizing: border-box;
            }
            input[type="email"]:focus, 
            input[type="password"]:focus, 
            input[type="text"]:focus { 
              outline: none; 
              border-color: #3b82f6; 
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); 
            }
            .btn { 
              width: 100%; 
              padding: 12px 24px; 
              background: #3b82f6; 
              color: white; 
              border: none; 
              border-radius: 8px; 
              font-size: 16px; 
              font-weight: 600; 
              cursor: pointer; 
              transition: all 0.2s;
            }
            .btn:hover { 
              background: #2563eb; 
              transform: translateY(-1px); 
            }
            .btn:active { 
              transform: translateY(0); 
            }
            .btn:disabled { 
              background: #9ca3af; 
              cursor: not-allowed; 
              transform: none; 
            }
            .error { 
              color: #dc2626; 
              background: #fef2f2; 
              border: 1px solid #fecaca; 
              border-radius: 8px; 
              padding: 12px; 
              margin-bottom: 20px; 
              display: none; 
            }
            .success { 
              color: #059669; 
              background: #ecfdf5; 
              border: 1px solid #a7f3d0; 
              border-radius: 8px; 
              padding: 12px; 
              margin-bottom: 20px; 
              display: none; 
            }
            .readonly { 
              background: #f9fafb; 
              color: #6b7280; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 Welcome to Medusa Admin</h1>
            <p class="subtitle">Complete your account setup to access the admin dashboard</p>
            
            <div id="error" class="error"></div>
            <div id="success" class="success"></div>
            
            <form id="inviteForm">
              <input type="hidden" name="token" value="${token}">
              
              <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" value="${invite.email}" readonly class="readonly">
              </div>
              
              <div class="form-group">
                <label for="first_name">First Name</label>
                <input type="text" id="first_name" name="first_name" required>
              </div>
              
              <div class="form-group">
                <label for="last_name">Last Name</label>
                <input type="text" id="last_name" name="last_name" required>
              </div>
              
              <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required minlength="8">
              </div>
              
              <div class="form-group">
                <label for="confirm_password">Confirm Password</label>
                <input type="password" id="confirm_password" name="confirm_password" required minlength="8">
              </div>
              
              <button type="submit" class="btn" id="submitBtn">
                Accept Invite & Create Account
              </button>
            </form>
          </div>

          <script>
            document.getElementById('inviteForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              const form = e.target;
              const formData = new FormData(form);
              const data = Object.fromEntries(formData.entries());
              
              const errorDiv = document.getElementById('error');
              const successDiv = document.getElementById('success');
              const submitBtn = document.getElementById('submitBtn');
              
              // Hide previous messages
              errorDiv.style.display = 'none';
              successDiv.style.display = 'none';
              
              // Validate passwords match
              if (data.password !== data.confirm_password) {
                errorDiv.textContent = 'Passwords do not match';
                errorDiv.style.display = 'block';
                return;
              }
              
              // Disable submit button
              submitBtn.disabled = true;
              submitBtn.textContent = 'Processing...';
              
              try {
                // Try the admin registration endpoint directly
                const response = await fetch('/admin/auth/user/emailpass/register', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    first_name: data.first_name,
                    last_name: data.last_name,
                    invite_token: data.token
                  })
                });
                
                const result = await response.text();
                
                if (response.ok) {
                  successDiv.textContent = 'Account created successfully! Redirecting to admin dashboard...';
                  successDiv.style.display = 'block';
                  
                  setTimeout(() => {
                    window.location.href = '/admin';
                  }, 2000);
                } else {
                  let errorMessage = 'Failed to accept invite';
                  try {
                    const errorData = JSON.parse(result);
                    errorMessage = errorData.message || errorMessage;
                  } catch (e) {
                    // If not JSON, use response text or default message
                    if (result && result.length < 200) {
                      errorMessage = result;
                    }
                  }
                  
                  errorDiv.textContent = errorMessage;
                  errorDiv.style.display = 'block';
                  
                  // Re-enable submit button
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Accept Invite & Create Account';
                }
              } catch (error) {
                console.error('Network error:', error);
                errorDiv.textContent = 'Network error. Please check your connection and try again.';
                errorDiv.style.display = 'block';
                
                // Re-enable submit button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Accept Invite & Create Account';
              }
            });
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error retrieving invite:', error);
    return res.status(500).send(`
      <html>
        <head>
          <title>Server Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f9fafb; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .error { color: #dc2626; text-align: center; }
            h1 { color: #374151; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">
              <h1>⚠️ Server Error</h1>
              <p>Unable to process the invite. Please contact your administrator.</p>
              <p><small>Error: ${error.message}</small></p>
            </div>
          </div>
        </body>
      </html>
    `);
  }
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    return res.status(400).json({
      message: "Missing invite token"
    });
  }

  try {
    const userModuleService: IUserModuleService = req.scope.resolve(Modules.USER);
    
    // Retrieve all invites and find the one with matching token
    const invites = await userModuleService.listInvites();
    const invite = invites.find(inv => inv.token === token);
    
    if (!invite) {
      return res.status(404).json({
        message: "Invalid or expired invite token"
      });
    }

    // Check if invite is already accepted
    if (invite.accepted) {
      return res.status(400).json({
        message: "This invite has already been accepted"
      });
    }

    // Return the invite info for validation - let the admin auth handle user creation
    return res.json({
      success: true,
      message: "Token is valid",
      invite: {
        email: invite.email,
        token: invite.token
      }
    });

  } catch (error) {
    console.error('Error validating invite:', error);
    return res.status(500).json({
      message: "Failed to validate invite",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}