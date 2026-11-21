import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { ReactNode } from "react"

type Props = {
  children: ReactNode
}

export const LocalProvider = async ({ children }: Props) => {

  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (

    <NextIntlClientProvider locale={locale} messages={{ landing: messages.landing }}>
      {children}
    </NextIntlClientProvider>
  )
}