import { StaffApp } from './staff/StaffApp'
import { CustomerApp } from './customer/CustomerApp'
import { useEffect } from 'react'
import { initPrinterStore } from './store/printer-store'

const mode = new URLSearchParams(window.location.search).get('mode') ?? 'staff'

export function App() {
  useEffect(() => {
    if (mode !== 'customer') void initPrinterStore()
  }, [])

  if (mode === 'customer') return <CustomerApp />

  return <StaffApp />
}