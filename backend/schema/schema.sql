CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  id_number TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  email TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE treatment_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  treatment_name TEXT NOT NULL,
  planned_sessions INTEGER NOT NULL DEFAULT 1,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  consent_type TEXT NOT NULL,
  treatment_areas TEXT NOT NULL,
  medical_conditions TEXT,
  personalized_risks TEXT,
  case_particularities TEXT,
  acceptance_points TEXT NOT NULL,
  photos_allowed BOOLEAN NOT NULL DEFAULT 0,
  therapist_name TEXT NOT NULL,
  signature_text TEXT NOT NULL,
  signed_at DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE working_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL UNIQUE,
  is_open BOOLEAN NOT NULL DEFAULT 1,
  start_time TIME,
  end_time TIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
