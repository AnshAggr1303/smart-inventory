'use client'
// Client component: needs useState to control modal open/close

import { useState } from 'react'
import { Plus } from 'lucide-react'
import AddSupplierModal from '@/app/(app)/suppliers/AddSupplierModal'

export default function AddSupplierButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold hover:-translate-y-px transition-transform"
      >
        <Plus className="w-4 h-4" />
        Add supplier
      </button>
      <AddSupplierModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
