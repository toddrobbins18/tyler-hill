# CSV Upload Format Guide

This guide provides the correct CSV format for each table that supports CSV uploads.

## General Rules
- First row must contain column headers
- All dates should be in YYYY-MM-DD format
- All times should be in HH:MM format (24-hour)
- Maximum 1000 rows per upload
- File must be .csv format

---

## Children (Roster)

**Table:** `children`

**Required Columns:**
- `name` - Child's full name

**Optional Columns:**
- `age` - Child's age (number)
- `grade` - Grade level
- `gender` - Gender (text)
- `guardian_email` - Guardian's email address
- `guardian_phone` - Guardian's phone number
- `emergency_contact` - Emergency contact information
- `medical_notes` - Any medical notes
- `allergies` - Allergy information
- `status` - Status (default: "active")
- `category` - Category classification
- `season` - Season (e.g., "Summer 2024")
- `group_name` - Group or cabin name

**Example CSV:**
```csv
name,age,grade,gender,guardian_email,guardian_phone,allergies,medical_notes,status
John Smith,10,5,Male,parent@example.com,555-1234,Peanuts,EpiPen required,active
Jane Doe,9,4,Female,jane.parent@example.com,555-5678,None,None,active
```

---

## Staff

**Table:** `staff`

**Required Columns:**
- `name` - Staff member's full name
- `role` - Staff role/position

**Optional Columns:**
- `email` - Email address
- `phone` - Phone number
- `department` - Department name
- `hire_date` - Hire date (YYYY-MM-DD)
- `status` - Status (default: "active")
- `season` - Season (e.g., "Summer 2024")

**Example CSV:**
```csv
name,role,email,phone,department,hire_date,status
John Counselor,Senior Counselor,john@camp.com,555-1234,Recreation,2024-06-01,active
Jane Leader,Division Leader,jane@camp.com,555-5678,Leadership,2024-06-01,active
```

---

## Daily Notes

**Table:** `daily_notes`

**Required Columns:**
- `date` - Note date (YYYY-MM-DD)
- `child_id` - UUID of the child (must exist in children table)

**Optional Columns:**
- `activities` - Activities description
- `meals` - Meal information
- `nap` - Nap/rest time notes
- `mood` - Child's mood
- `notes` - Additional notes

**Example CSV:**
```csv
date,child_id,activities,meals,nap,mood,notes
2024-06-15,abc123-uuid-here,Swimming and arts,Ate well,Napped 1 hour,Happy,Great day
```

---

## Medication Logs

**Table:** `medication_logs`

**Required Columns:**
- `date` - Medication date (YYYY-MM-DD)
- `child_id` - UUID of the child
- `medication_name` - Name of medication
- `meal_time` - One of: "Before Breakfast", "After Breakfast", "Before Lunch", "After Lunch", "Before Dinner", "After Dinner", "Bedtime"

**Optional Columns:**
- `dosage` - Dosage amount (e.g., "5ml", "1 tablet")
- `notes` - Additional notes
- `is_recurring` - true/false (default: false)
- `frequency` - "daily", "weekly", or "custom"
- `end_date` - End date for recurring medications (YYYY-MM-DD)

**Example CSV:**
```csv
date,child_id,medication_name,meal_time,dosage,notes
2024-06-15,abc123-uuid,Ibuprofen,After Lunch,5ml,For headache
2024-06-15,xyz789-uuid,Allergy Medicine,Before Breakfast,1 tablet,Daily medication
```

---

## Awards

**Table:** `awards`

**Required Columns:**
- `date` - Award date (YYYY-MM-DD)
- `title` - Award title
- `child_id` - UUID of the child

**Optional Columns:**
- `category` - Award category
- `description` - Award description

**Example CSV:**
```csv
date,title,child_id,category,description
2024-06-15,Best Swimmer,abc123-uuid,Sports,Excellent swimming performance
2024-06-15,Team Player,xyz789-uuid,Social,Great teamwork
```

---

## Incident Reports

**Table:** `incident_reports`

**Required Columns:**
- `date` - Incident date (YYYY-MM-DD)
- `type` - Incident type
- `description` - Incident description

**Optional Columns:**
- `child_id` - UUID of the child involved
- `severity` - Severity level
- `reported_by` - Name of person reporting
- `status` - Status (default: "open")

**Example CSV:**
```csv
date,type,description,child_id,severity,reported_by,status
2024-06-15,Minor Injury,Scraped knee on playground,abc123-uuid,Low,Jane Counselor,resolved
```

---

## Trips (Transportation)

**Table:** `trips`

**Required Columns:**
- `date` - Trip date (YYYY-MM-DD)
- `name` - Trip name
- `type` - Trip type

**Optional Columns:**
- `destination` - Destination location
- `departure_time` - Departure time (HH:MM)
- `return_time` - Return time (HH:MM)
- `capacity` - Maximum capacity (number)
- `driver` - Driver name
- `chaperone` - Chaperone name
- `transportation_type` - Type of transport (e.g., "Bus", "Van")
- `event_type` - Event type
- `event_length` - Event duration
- `meal` - Meal information
- `status` - Status (default: "upcoming")

**Example CSV:**
```csv
date,name,type,destination,departure_time,return_time,capacity,driver,chaperone
2024-06-20,Museum Visit,Field Trip,Science Museum,09:00,15:00,50,John Driver,Jane Leader
2024-06-22,Baseball Game,Sports Event,City Stadium,14:00,18:00,30,Mike Driver,Tom Coach
```

---

## Menu Items

**Table:** `menu_items`

**Required Columns:**
- `date` - Menu date (YYYY-MM-DD)
- `meal_type` - Meal type (e.g., "Breakfast", "Lunch", "Dinner")
- `items` - Menu items description

**Optional Columns:**
- `allergens` - Allergen information

**Example CSV:**
```csv
date,meal_type,items,allergens
2024-06-15,Breakfast,Pancakes and fruit,Gluten
2024-06-15,Lunch,Chicken sandwich and salad,None
2024-06-15,Dinner,Pasta with marinara sauce,Gluten
```

---

## Master Calendar Events

**Table:** `master_calendar`

**Required Columns:**
- `event_date` - Event date (YYYY-MM-DD)
- `title` - Event title
- `type` - Event type

**Optional Columns:**
- `description` - Event description
- `time` - Event time (HH:MM)
- `location` - Event location
- `division_id` - UUID of division (if division-specific)

**Example CSV:**
```csv
event_date,title,type,description,time,location
2024-06-20,Talent Show,Entertainment,Annual camp talent show,19:00,Main Hall
2024-06-22,Field Day,Activity,Outdoor games and competitions,10:00,Sports Field
```

---

## Sports Calendar

**Table:** `sports_calendar`

**Required Columns:**
- `event_date` - Event date (YYYY-MM-DD)
- `title` - Event title
- `sport_type` - Sport type (e.g., "basketball", "soccer", "baseball", "swimming", "track")

**Optional Columns:**
- `description` - Event description
- `time` - Event time (HH:MM)
- `location` - Event location
- `team` - Team name
- `opponent` - Opponent team name
- `division_id` - UUID of division (if division-specific)

**Example CSV:**
```csv
event_date,title,sport_type,time,location,team,opponent
2024-06-25,Basketball Game,basketball,15:00,Main Court,Red Team,Blue Team
2024-06-27,Swimming Meet,swimming,10:00,Pool,Camp Sharks,Lake Swimmers
```

---

## Notes

1. **UUIDs**: When referencing children, staff, or divisions, you must use their actual UUID from the database. You can find these by viewing the respective tables first.

2. **Date Format**: Always use YYYY-MM-DD format (e.g., 2024-06-15)

3. **Time Format**: Always use HH:MM in 24-hour format (e.g., 14:30 for 2:30 PM)

4. **Boolean Values**: Use "true" or "false" (lowercase)

5. **Empty Values**: Leave cells empty or use "None" or "N/A" for optional fields

6. **Validation**: The system will validate all data before inserting. Invalid rows will be rejected with error messages.

7. **Meal Times**: For medication logs, must use exact values: "Before Breakfast", "After Breakfast", "Before Lunch", "After Lunch", "Before Dinner", "After Dinner", "Bedtime"
