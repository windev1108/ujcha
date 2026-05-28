import { StaffApp } from './staff/StaffApp'
import { CustomerApp } from './customer/CustomerApp'
import { useEffect } from 'react'
import { initPrinterStore } from './store/printer-store'

const mode = new URLSearchParams(window.location.search).get('mode') ?? 'staff'

export function App() {
  if (mode === 'customer') return <CustomerApp />

  useEffect(() => {
    void initPrinterStore()
  }, [])

  return <StaffApp />
}
