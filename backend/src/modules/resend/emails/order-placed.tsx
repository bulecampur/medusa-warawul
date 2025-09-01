import { 
  Text, 
  Column, 
  Container, 
  Heading, 
  Html, 
  Img, 
  Row, 
  Section, 
  Tailwind, 
  Head, 
  Preview, 
  Body, 
  Link, 
} from "@react-email/components"
import { BigNumberValue, CustomerDTO, OrderDTO } from "@medusajs/framework/types"

/**
 * The key for the OrderPlaced template, used to identify it
 */
export const ORDER_PLACED = "order.placed"

type OrderPlacedEmailProps = {
  order: OrderDTO & {
    customer: CustomerDTO
  }
  email_banner?: {
    body: string
    title: string
    url: string
  }
}

function OrderPlacedEmailComponent({ order, email_banner }: OrderPlacedEmailProps) {
  const shouldDisplayBanner = email_banner && "title" in email_banner

  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code,
  })

  const formatPrice = (price: BigNumberValue) => {
    if (typeof price === "number") {
      return formatter.format(price)
    }

    if (typeof price === "string") {
      return formatter.format(parseFloat(price))
    }

    return price?.toString() || ""
  }

  return (
    <Tailwind>
      <Html className="font-sans bg-gray-100">
        <Head />
        <Preview>Thank you for your order from Warawul Coffee</Preview>
        <Body className="bg-white my-10 mx-auto w-full max-w-2xl">
          {/* Header */}
          <Section className="bg-[#8B4513] text-white px-6 py-4">
            <Heading className="text-2xl font-bold text-center text-white m-0">
              Warawul Coffee
            </Heading>
          </Section>

          {/* Thank You Message */}
          <Container className="p-6">
            <Heading className="text-2xl font-bold text-center text-gray-800">
              Thank you for your order, {order.customer?.first_name || order.shipping_address?.first_name || "Valued Customer"}
            </Heading>
            <Text className="text-center text-gray-600 mt-2">
              We're processing your order and will notify you when it ships.
            </Text>
          </Container>

          {/* Promotional Banner */}
          {shouldDisplayBanner && (
            <Container
              className="mb-4 rounded-lg p-7"
              style={{
                background: "linear-gradient(to right, #8B4513, #A0522D)",
              }}
            >
              <Section>
                <Row>
                  <Column align="left">
                    <Heading className="text-white text-xl font-semibold">
                      {email_banner.title}
                    </Heading>
                    <Text className="text-white mt-2">{email_banner.body}</Text>
                  </Column>
                  <Column align="right">
                    <Link href={email_banner.url} className="font-semibold px-2 text-white underline">
                      Shop Now
                    </Link>
                  </Column>
                </Row>
              </Section>
            </Container>
          )}

          {/* Order Items */}
          <Container className="px-6">
            <Heading className="text-xl font-semibold text-gray-800 mb-4">
              Your Items
            </Heading>
            <Row>
              <Column>
                <Text className="text-sm m-0 my-2 text-gray-500">Order ID: #{order.display_id}</Text>
              </Column>
            </Row>
            {order.items?.map((item) => (
              <Section key={item.id} className="border-b border-gray-200 py-4">
                <Row>
                  <Column className="w-1/3">
                    <Img
                      src={item.thumbnail ?? ""}
                      alt={item.product_title ?? ""}
                      className="rounded-lg"
                      width="100%"
                    />
                  </Column>
                  <Column className="w-2/3 pl-4">
                    <Text className="text-lg font-semibold text-gray-800">
                      {item.product_title}
                    </Text>
                    <Text className="text-gray-600">{item.variant_title}</Text>
                    <Text className="text-gray-800 mt-2 font-bold">
                      {formatPrice(item.total)}
                    </Text>
                  </Column>
                </Row>
              </Section>
            ))}

            {/* Order Summary */}
            <Section className="mt-8">
              <Heading className="text-xl font-semibold text-gray-800 mb-4">
                Order Summary
              </Heading>
              <Row className="text-gray-600">
                <Column className="w-1/2">
                  <Text className="m-0">Subtotal</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text className="m-0">
                    {formatPrice(order.item_total)}
                  </Text>
                </Column>
              </Row>
              {order.shipping_methods?.map((method) => (
                <Row className="text-gray-600" key={method.id}>
                  <Column className="w-1/2">
                    <Text className="m-0">{method.name}</Text>
                  </Column>
                  <Column className="w-1/2 text-right">
                    <Text className="m-0">{formatPrice(method.total)}</Text>
                  </Column>
                </Row>
              ))}
              <Row className="text-gray-600">
                <Column className="w-1/2">
                  <Text className="m-0">Tax</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text className="m-0">{formatPrice(order.tax_total || 0)}</Text>
                </Column>
              </Row>
              <Row className="border-t border-gray-200 mt-4 text-gray-800 font-bold">
                <Column className="w-1/2">
                  <Text>Total</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text>{formatPrice(order.total)}</Text>
                </Column>
              </Row>
            </Section>
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-6 mt-10">
            <Text className="text-center text-gray-500 text-sm">
              If you have any questions, reply to this email or contact our support team at support@warawul.coffee.
            </Text>
            <Text className="text-center text-gray-500 text-sm">
              Order Token: {order.id}
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-4">
              © {new Date().getFullYear()} Warawul Coffee. All rights reserved.
            </Text>
          </Section>
        </Body>
      </Html>
    </Tailwind >
  )
}

export const orderPlacedEmail = (props: { order: any, invoice?: any }) => {
  // Transform the data to match the expected props
  const transformedProps: OrderPlacedEmailProps = {
    order: {
      ...props.order,
      customer: props.order?.customer || null,
    }
  }

  return <OrderPlacedEmailComponent {...transformedProps} />
}

export default OrderPlacedEmailComponent