export function isHardwareArchived(hardware) {
  return hardware?.ativo === false
}

export function archiveWasConfirmed(items, hardwareId) {
  const hardware = (items || []).find((item) => item.id === hardwareId)
  return hardware === undefined || isHardwareArchived(hardware)
}
