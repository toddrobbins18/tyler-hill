import { StaffMember } from "@/types/staff";

export const initialStaffData: StaffMember[] = [
  // PROGRAMMING
  { id: 'prog-1', name: 'Lisa Safier', position: 'Program Director', department: 'PROGRAMMING', actualBudget: 14000, proposedBudget: 14250, kidCredit: 0, netBudget: 14250, status: 'hired' },
  { id: 'prog-2', name: 'Mike Lynch', position: 'Program Director', department: 'PROGRAMMING', actualBudget: 5500, proposedBudget: 6000, kidCredit: 0, netBudget: 6000, status: 'hired' },
  { id: 'prog-3', name: 'Britt Gilmore', position: 'Web/Photo', department: 'PROGRAMMING', actualBudget: 500, proposedBudget: 4000, kidCredit: 0, netBudget: 4000, status: 'hired' },
  { id: 'prog-4', name: 'Lauren Braun', position: 'Video/Photo', department: 'PROGRAMMING', actualBudget: 1000, proposedBudget: 4500, kidCredit: 1000, netBudget: 3500, status: 'hired' },

  // ADMINISTRATION
  { id: 'admin-1', name: 'Ruthie', position: 'Office', department: 'ADMINISTRATION', actualBudget: 0, proposedBudget: 0, kidCredit: 0, netBudget: 0, status: 'to-hire' },
  { id: 'admin-2', name: 'Alma Mejia', position: 'Office', department: 'ADMINISTRATION', actualBudget: 4500, proposedBudget: 4600, kidCredit: 0, netBudget: 4600, status: 'hired' },
  { id: 'admin-3', name: 'Caitlin Amatrudo', position: 'Nurse', department: 'ADMINISTRATION', actualBudget: 5000, proposedBudget: 9000, kidCredit: 2400, netBudget: 6600, status: 'hired' },
  { id: 'admin-4', name: 'Mary Gochna', position: 'Nurse', department: 'ADMINISTRATION', actualBudget: 3400, proposedBudget: 4250, kidCredit: 500, netBudget: 3750, status: 'hired' },
  { id: 'admin-5', name: 'Christina Boll', position: 'Nurse', department: 'ADMINISTRATION', actualBudget: 5500, proposedBudget: 8200, kidCredit: 2500, netBudget: 5700, status: 'hired' },
  { id: 'admin-6', name: 'Jami Berg', position: 'Nurse', department: 'ADMINISTRATION', actualBudget: 0, proposedBudget: 4000, kidCredit: 2500, netBudget: 1500, status: 'to-hire' },
  { id: 'admin-7', name: 'Danny Anderson', position: 'Security', department: 'ADMINISTRATION', actualBudget: 4375, proposedBudget: 5750, kidCredit: 0, netBudget: 5750, status: 'hired' },

  // FOOD SERVICE
  { id: 'food-1', name: 'Joyce Amitrano', position: 'Kitchen', department: 'FOOD SERVICE', actualBudget: 10000, proposedBudget: 10000, kidCredit: 0, netBudget: 10000, status: 'hired' },
  { id: 'food-2', name: 'Susan Davitt', position: 'Kitchen', department: 'FOOD SERVICE', actualBudget: 2500, proposedBudget: 4000, kidCredit: 0, netBudget: 4000, status: 'hired' },
  { id: 'food-3', name: 'Jocelyn Bonavoglia', position: 'Kitchen', department: 'FOOD SERVICE', actualBudget: 8000, proposedBudget: 9000, kidCredit: 0, netBudget: 9000, status: 'hired' },
  { id: 'food-4', name: 'Nico Coccarelli', position: 'Kitchen', department: 'FOOD SERVICE', actualBudget: 4000, proposedBudget: 4000, kidCredit: 0, netBudget: 4000, status: 'hired' },
  { id: 'food-5', name: 'Justin Koehler, Jr.', position: 'Kitchen', department: 'FOOD SERVICE', actualBudget: 4000, proposedBudget: 4000, kidCredit: 0, netBudget: 4000, status: 'hired' },
  { id: 'food-6', name: 'Irma Telue', position: 'Kitchen', department: 'FOOD SERVICE', actualBudget: 4600, proposedBudget: 4700, kidCredit: 0, netBudget: 4700, status: 'hired' },

  // MAINTENANCE
  { id: 'maint-1', name: 'Troy Stephenson', position: 'Maintenance', department: 'MAINTENANCE', actualBudget: 4000, proposedBudget: 4850, kidCredit: 0, netBudget: 4850, status: 'hired' },
  { id: 'maint-2', name: 'Doris', position: 'Maintenance', department: 'MAINTENANCE', actualBudget: 3000, proposedBudget: 3000, kidCredit: 0, netBudget: 3000, status: 'hired' },

  // TRANSPORTATION
  { id: 'trans-1', name: 'Adam Lenneberg', position: 'Transportation', department: 'TRANSPORTATION', actualBudget: 10250, proposedBudget: 10500, kidCredit: 0, netBudget: 10500, status: 'hired' },
  { id: 'trans-2', name: 'Errol - Gas/Spare', position: 'Trans/Lot', department: 'TRANSPORTATION', actualBudget: 5200, proposedBudget: 5200, kidCredit: 0, netBudget: 5200, status: 'hired' },
  { id: 'trans-3', name: 'Position Open', position: 'Driver', department: 'TRANSPORTATION', actualBudget: 4000, proposedBudget: 0, kidCredit: 0, netBudget: 0, status: 'to-hire' },
  { id: 'trans-4', name: 'Clara Milana', position: 'Driver', department: 'TRANSPORTATION', actualBudget: 0, proposedBudget: 5000, kidCredit: 0, netBudget: 5000, status: 'to-hire' },
  { id: 'trans-5', name: 'Mercedes Gamboa', position: 'Driver', department: 'TRANSPORTATION', actualBudget: 4900, proposedBudget: 5000, kidCredit: 0, netBudget: 5000, status: 'hired' },
  { id: 'trans-6', name: 'Bruce Kaufman', position: 'Driver', department: 'TRANSPORTATION', actualBudget: 4000, proposedBudget: 5000, kidCredit: 0, netBudget: 5000, status: 'hired' },

  // CREATIVE ARTS
  { id: 'art-1', name: 'Shea Villalobos', position: 'Crafts/Woodwork', department: 'CREATIVE ARTS', actualBudget: 2450, proposedBudget: 3000, kidCredit: 0, netBudget: 3000, status: 'hired', notes: 'missing week 3 T-F' },
  { id: 'art-2', name: 'Michael Espinoza', position: 'Crafts/Woodwork', department: 'CREATIVE ARTS', actualBudget: 3000, proposedBudget: 4500, kidCredit: 1500, netBudget: 3000, status: 'hired', notes: 'Athena' },
];
