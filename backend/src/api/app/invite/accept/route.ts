import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IUserModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { token, email } = req.body as {
    token?: string;
    email?: string;
  };

  if (!token || !email) {
    return res.status(400).json({
      message: "Missing required fields: token, email"
    });
  }

  try {
    const userModuleService: IUserModuleService = req.scope.resolve(Modules.USER);
    
    // Find the invite by token
    const invites = await userModuleService.listInvites();
    const invite = invites.find(inv => inv.token === token && inv.email === email);
    
    if (!invite) {
      return res.status(404).json({
        message: "Invite not found"
      });
    }

    // Mark invite as accepted
    await userModuleService.updateInvites({
      id: invite.id,
      accepted: true,
    });

    return res.json({
      success: true,
      message: "Invite marked as accepted"
    });

  } catch (error) {
    console.error('Error marking invite as accepted:', error);
    return res.status(500).json({
      message: "Failed to mark invite as accepted",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}