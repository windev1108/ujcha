import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  fetchAddresses, createAddress, updateAddress,
  deleteAddress, setDefaultAddress,
} from '@/services/order/api'
import { QK } from '@/constants/query-keys'
import type { UserAddress } from '@/types'

const EMPTY_FORM = { fullAddress: '', label: '', name: '', phone: '', note: '' }

export default function AddressesScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<UserAddress | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: QK.addresses,
    queryFn: fetchAddresses,
  })

  const createMutation = useMutation({
    mutationFn: createAddress,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK.addresses }); close() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserAddress> }) => updateAddress(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK.addresses }); close() },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK.addresses }),
  })

  const defaultMutation = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK.addresses }),
  })

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(addr: UserAddress) {
    setEditing(addr)
    setForm({ fullAddress: addr.fullAddress, label: addr.label ?? '', name: addr.name, phone: addr.phone, note: addr.note ?? '' })
    setShowModal(true)
  }

  function close() {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function handleSave() {
    if (!form.fullAddress.trim()) { Alert.alert(t('error_enter_delivery_address')); return }
    if (!form.name.trim()) { Alert.alert(t('error_name_required')); return }
    if (!form.phone.trim()) { Alert.alert(t('error_phone_required')); return }

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form })
    } else {
      createMutation.mutate(form as any)
    }
  }

  function confirmDelete(id: string) {
    Alert.alert(t('delete_address'), t('are_you_sure'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ])
  }

  return (
    <View className="flex-1 bg-surface-soft">
      <ScreenHeader
        title={t('shipping_addresses')}
        right={
          <TouchableOpacity onPress={openNew} hitSlop={8}>
            <Ionicons name="add" size={24} color="#1a3c34" />
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <ActivityIndicator color="#1a3c34" className="mt-16" />
      ) : addresses.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="location-outline" size={48} color="#717171" />
          <Text className="text-muted mt-3 mb-6">{t('no_address')}</Text>
          <Button onPress={openNew}>{t('add_new_address')}</Button>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl border border-black/5 p-4 mb-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-[15px] font-semibold text-ink">{item.name}</Text>
                    {item.isDefault && (
                      <View className="bg-primary rounded-full px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-white">{t('default_address')}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-muted">{item.phone}</Text>
                  <Text className="text-sm text-ink mt-1">{item.fullAddress}</Text>
                </View>
                <View className="flex-row gap-2 ml-2">
                  <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={18} color="#717171" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color="#c45c5c" />
                  </TouchableOpacity>
                </View>
              </View>
              {!item.isDefault && (
                <TouchableOpacity
                  onPress={() => defaultMutation.mutate(item.id)}
                  className="mt-3 self-start"
                >
                  <Text className="text-sm text-primary">{t('set_as_default_address')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScreenHeader title={editing ? t('edit_address') : t('add_new_address')} />
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Input label={t('recipient_name_label')} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
            <Input label={t('phone_number')} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
            <Input label={t('full_address')} value={form.fullAddress} onChangeText={(v) => setForm((f) => ({ ...f, fullAddress: v }))} multiline />
            <Input label={t('address_label_optional')} placeholder={t('address_label_placeholder_text')} value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v }))} />
            <Input label={t('address_note_optional')} placeholder={t('address_note_placeholder')} value={form.note} onChangeText={(v) => setForm((f) => ({ ...f, note: v }))} />
            <Button
              onPress={handleSave}
              loading={createMutation.isPending || updateMutation.isPending}
              size="lg"
              className="w-full mb-3"
            >
              {t('save_address')}
            </Button>
            <Button variant="secondary" onPress={close} size="lg" className="w-full">{t('cancel')}</Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}
