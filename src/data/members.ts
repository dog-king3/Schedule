export type Member = {
  id: string
  name: string
  role: string
  email: string
  temporary?: boolean
}

export const members: Member[] = [
  { id: 'mahima-shah', name: 'Mahima Shah', role: 'Co-President', email: 'mahshah1@dunlapstudents.net' },
  { id: 'nikhil-nayak', name: 'Nikhil Nayak', role: 'Co-President', email: 'niknayak@dunlapstudents.net' },
  { id: 'sana-shajahan', name: 'Sana Shajahan', role: 'Secretary/Treasurer', email: 'sanshajahan@dunlapstudents.net' },
  { id: 'julia-charles', name: 'Julia Charles', role: 'Co-President', email: 'julcharles@dunlapstudents.net' },
  { id: 'erin-copple', name: 'Erin Copple', role: 'Faculty Advisor', email: 'ecopple@dunlapcusd.net' },
  { id: 'sanay-sumesh', name: 'Sanay Sumesh', role: 'Service/Support Head', email: 'sansumesh@dunlapstudents.net' },
  { id: 'sayan-sumeeth', name: 'Sayan Sumeeth', role: 'Service/Support Head', email: 'saysumeeth@dunlapstudents.net' },
  { id: 'sitaara-jorden', name: 'Sitaara Jorden', role: 'Pop-Tab President', email: 'sitjorden@dunlapstudents.net' },
  { id: 'arvin-baviskar', name: 'Arvin Baviskar', role: 'Pop-Tab President', email: 'arvbaviskar@dunlapstudents.net' },
  { id: 'cora-bradley', name: 'Cora Bradley', role: 'Spirit Head', email: 'corbradley@dunlapstudents.net' },
  { id: 'laura-lang', name: 'Laura Lang', role: 'Spirit Head', email: 'laulang@dunlapstudents.net' },
  { id: 'amili-sinha', name: 'Amili Sinha', role: 'Social Head', email: 'amisinha@dunlapstudents.net' },
  { id: 'chizara-opara', name: 'Chizara Opara', role: 'Social Head', email: 'chiopara@dunlapstudents.net' },
  { id: 'rishik-meduru', name: 'Rishik Meduru', role: 'Dance Committee', email: 'rismeduru@dunlapstudents.net' },
  { id: 'temporary-tech-specialist', name: 'Temporary Test Account', role: 'Tech Specialist', email: 'covertk912812@gmail.com', temporary: true },
]

export function getMemberByEmail(email: string | null | undefined): Member | undefined {
  const normalizedEmail = email?.trim().toLowerCase()
  return normalizedEmail
    ? members.find((member) => member.email.toLowerCase() === normalizedEmail)
    : undefined
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
