export type Member = {
  id: string
  name: string
  role: string
  email?: string
}

export const members: Member[] = [
  { id: 'nikhil-nayak', name: 'Nikhil Nayak', role: 'President', email: 'niknayak@dunlapstudents.net' },
  { id: 'julia-charles', name: 'Julia Charles', role: 'President', email: 'julcharles@dunlapstudents.net' },
  { id: 'mahima-shah', name: 'Mahima Shah', role: 'President' },
  { id: 'sana-shahjahan', name: 'Sana Shahjahan', role: 'Treasurer / Secretary' },
  { id: 'arvin-baviskar', name: 'Arvin Baviskar', role: 'Pop Tab President' },
  { id: 'srivi-rayasam', name: 'Srivi Rayasam', role: 'Pop Tab President' },
  { id: 'sitaara-jordan', name: 'Sitaara Jordan', role: 'Pop Tab President' },
  { id: 'sanay', name: 'Sanay', role: 'Service / Support Head' },
  { id: 'sayan', name: 'Sayan', role: 'Service / Support Head' },
  { id: 'amili', name: 'Amili', role: 'Social Head' },
  { id: 'chizara', name: 'Chizara', role: 'Social Head' },
  { id: 'cora', name: 'Cora', role: 'Spirit Head' },
  { id: 'laura', name: 'Laura', role: 'Spirit Head' },
  { id: 'mrs-copple', name: 'Mrs. Copple', role: 'Teacher Administrator' },
]

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
