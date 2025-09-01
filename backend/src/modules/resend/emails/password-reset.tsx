import { 
  Text, 
  Column, 
  Container, 
  Heading, 
  Html, 
  Row, 
  Section, 
  Tailwind, 
  Head, 
  Preview, 
  Body, 
  Link, 
  Button,
} from "@react-email/components"
import { CustomerDTO } from "@medusajs/framework/types"

/**
 * The key for the PasswordReset template, used to identify it
 */
export const PASSWORD_RESET = "customer.password_reset"

type PasswordResetEmailProps = {
  customer: CustomerDTO
  reset_token: string
  reset_url?: string
  storefront_url?: string
  expires_at?: string
}

function PasswordResetEmailComponent({ 
  customer, 
  reset_token,
  reset_url,
  storefront_url = "https://warawul.coffee",
  expires_at
}: PasswordResetEmailProps) {
  const customerName = customer.first_name || customer.last_name 
    ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    : 'Coffee Lover'

  // Construct reset URL if not provided
  const resetLink = reset_url || `${storefront_url}/account/reset-password?token=${reset_token}`
  
  // Format expiration time
  const expirationTime = expires_at ? new Date(expires_at).toLocaleString() : '1 hour'

  return (
    <Tailwind>
      <Html className="font-sans bg-gray-100">
        <Head />
        <Preview>Reset your Warawul Coffee password</Preview>
        <Body className="bg-white my-10 mx-auto w-full max-w-2xl">
          {/* Header */}
          <Section className="bg-[#8B4513] text-white px-6 py-4">
            <Heading className="text-2xl font-bold text-center text-white m-0">
              Warawul Coffee
            </Heading>
          </Section>

          {/* Main Message */}
          <Container className="p-6">
            <Heading className="text-2xl font-bold text-center text-gray-800">
              Reset Your Password
            </Heading>
            <Text className="text-center text-gray-600 mt-4">
              Hi {customerName}, we received a request to reset your password for your Warawul Coffee account.
            </Text>
          </Container>

          {/* Reset Instructions */}
          <Container className="px-6">
            <Section className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6">
              <Text className="text-amber-800 m-0 font-semibold">
                🔒 Password Reset Request
              </Text>
              <Text className="text-amber-700 mt-2 mb-0">
                Click the button below to create a new password. This link will expire in {typeof expires_at === 'string' ? 'at ' + expirationTime : expirationTime}.
              </Text>
            </Section>

            {/* Reset Button */}
            <Section className="text-center mb-6">
              <Button
                className="bg-[#8B4513] text-white px-8 py-4 rounded-lg font-semibold no-underline inline-block text-lg"
                href={resetLink}
              >
                Reset My Password
              </Button>
            </Section>

            {/* Alternative Link */}
            <Section className="mb-6">
              <Text className="text-gray-600 text-sm">
                If the button doesn't work, copy and paste this link into your browser:
              </Text>
              <Text className="text-[#8B4513] text-sm break-all">
                <Link href={resetLink}>{resetLink}</Link>
              </Text>
            </Section>

            {/* Security Notice */}
            <Section className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <Text className="text-red-800 m-0 font-semibold">
                🛡️ Security Notice
              </Text>
              <Text className="text-red-700 mt-2 mb-2">
                If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
              </Text>
              <Text className="text-red-700 m-0 text-sm">
                For your security, never share this link with anyone else.
              </Text>
            </Section>

            {/* Account Details */}
            <Section className="bg-gray-50 p-4 rounded-lg">
              <Heading className="text-lg font-semibold text-gray-800 mb-3">
                Account Information
              </Heading>
              <Text className="text-gray-600 m-0">
                <strong>Email:</strong> {customer.email}
              </Text>
              <Text className="text-gray-600 m-0 mt-1">
                <strong>Account ID:</strong> {customer.id}
              </Text>
              <Text className="text-gray-600 m-0 mt-1">
                <strong>Reset Token:</strong> {reset_token.substring(0, 8)}...
              </Text>
            </Section>
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-6 mt-10">
            <Text className="text-center text-gray-500 text-sm">
              Need help? Contact our support team at support@warawul.coffee
            </Text>
            <Text className="text-center text-gray-500 text-sm mt-2">
              Visit us at <Link href={storefront_url} className="text-[#8B4513]">warawul.coffee</Link>
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-4">
              © {new Date().getFullYear()} Warawul Coffee. All rights reserved.
            </Text>
          </Section>
        </Body>
      </Html>
    </Tailwind>
  )
}

export const passwordResetEmail = (props: { 
  customer: any
  reset_token: string
  reset_url?: string
  storefront_url?: string
  expires_at?: string
}) => {
  const transformedProps: PasswordResetEmailProps = {
    customer: props.customer,
    reset_token: props.reset_token,
    reset_url: props.reset_url,
    storefront_url: props.storefront_url,
    expires_at: props.expires_at
  }

  return <PasswordResetEmailComponent {...transformedProps} />
}

export default PasswordResetEmailComponent