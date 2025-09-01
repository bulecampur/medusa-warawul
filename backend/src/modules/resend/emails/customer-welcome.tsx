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
 * The key for the CustomerWelcome template, used to identify it
 */
export const CUSTOMER_WELCOME = "customer.created"

type CustomerWelcomeEmailProps = {
  customer: CustomerDTO
  storefront_url?: string
}

function CustomerWelcomeEmailComponent({ customer, storefront_url = "https://warawul.coffee" }: CustomerWelcomeEmailProps) {
  const customerName = customer.first_name || customer.last_name 
    ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    : 'Coffee Lover'

  return (
    <Tailwind>
      <Html className="font-sans bg-gray-100">
        <Head />
        <Preview>Welcome to Warawul Coffee! Your account has been created.</Preview>
        <Body className="bg-white my-10 mx-auto w-full max-w-2xl">
          {/* Header */}
          <Section className="bg-[#8B4513] text-white px-6 py-4">
            <Heading className="text-2xl font-bold text-center text-white m-0">
              Warawul Coffee
            </Heading>
          </Section>

          {/* Welcome Message */}
          <Container className="p-6">
            <Heading className="text-2xl font-bold text-center text-gray-800">
              Welcome to Warawul Coffee, {customerName}! ☕
            </Heading>
            <Text className="text-center text-gray-600 mt-4">
              Thank you for joining our coffee community. We're excited to have you with us!
            </Text>
          </Container>

          {/* Benefits Section */}
          <Container className="px-6">
            <Heading className="text-xl font-semibold text-gray-800 mb-4">
              What's Next?
            </Heading>
            
            <Section className="mb-6">
              <Row className="mb-4">
                <Column className="w-full">
                  <div className="flex items-start">
                    <div className="bg-[#8B4513] text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 mt-1 text-sm font-bold">
                      1
                    </div>
                    <div>
                      <Text className="text-gray-800 font-semibold m-0">Browse Our Premium Coffee Selection</Text>
                      <Text className="text-gray-600 mt-1">Discover our carefully curated collection of specialty coffees from around the world.</Text>
                    </div>
                  </div>
                </Column>
              </Row>

              <Row className="mb-4">
                <Column className="w-full">
                  <div className="flex items-start">
                    <div className="bg-[#8B4513] text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 mt-1 text-sm font-bold">
                      2
                    </div>
                    <div>
                      <Text className="text-gray-800 font-semibold m-0">Track Your Orders</Text>
                      <Text className="text-gray-600 mt-1">Keep track of your purchases and delivery status right from your account.</Text>
                    </div>
                  </div>
                </Column>
              </Row>

              <Row className="mb-6">
                <Column className="w-full">
                  <div className="flex items-start">
                    <div className="bg-[#8B4513] text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 mt-1 text-sm font-bold">
                      3
                    </div>
                    <div>
                      <Text className="text-gray-800 font-semibold m-0">Enjoy Exclusive Member Benefits</Text>
                      <Text className="text-gray-600 mt-1">Get early access to new blends and special member-only discounts.</Text>
                    </div>
                  </div>
                </Column>
              </Row>
            </Section>

            {/* CTA Button */}
            <Section className="text-center mb-6">
              <Button
                className="bg-[#8B4513] text-white px-6 py-3 rounded-lg font-semibold no-underline inline-block"
                href={storefront_url}
              >
                Start Shopping ☕
              </Button>
            </Section>

            {/* Account Details */}
            <Section className="bg-gray-50 p-4 rounded-lg">
              <Heading className="text-lg font-semibold text-gray-800 mb-3">
                Your Account Details
              </Heading>
              <Text className="text-gray-600 m-0">
                <strong>Email:</strong> {customer.email}
              </Text>
              {(customer.first_name || customer.last_name) && (
                <Text className="text-gray-600 m-0 mt-1">
                  <strong>Name:</strong> {customerName}
                </Text>
              )}
              <Text className="text-gray-600 m-0 mt-1">
                <strong>Account ID:</strong> {customer.id}
              </Text>
            </Section>
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-6 mt-10">
            <Text className="text-center text-gray-500 text-sm">
              Need help? Reply to this email or contact us at support@warawul.coffee
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

export const customerWelcomeEmail = (props: { customer: any, storefront_url?: string }) => {
  const transformedProps: CustomerWelcomeEmailProps = {
    customer: props.customer,
    storefront_url: props.storefront_url
  }

  return <CustomerWelcomeEmailComponent {...transformedProps} />
}

export default CustomerWelcomeEmailComponent