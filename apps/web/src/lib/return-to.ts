export function safeReturnTo(value: string | null) {
  if (
    value &&
    ([
      '/account',
      '/platform',
      '/invitations',
      '/organizations',
      '/editions',
      '/registrations',
      '/account/profile',
    ].includes(value) ||
      /^\/editions\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        value,
      ))
  )
    return value;
  return '/account';
}
