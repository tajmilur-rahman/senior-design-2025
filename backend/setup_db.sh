#!/bin/bash
# 1. Wipe old tables
sudo -u postgres psql -d bugbug_data -c "DROP TABLE IF EXISTS bugs, users, companies, feedback CASCADE;"

# 2. Rebuild Tables and Create Admin
python3 -c "from database import engine; import models; models.Base.metadata.create_all(bind=engine)"
python3 -c "import models, auth; from database import SessionLocal; db=SessionLocal(); h=auth.get_password_hash('password123'); c=models.Company(id=1, name='DemoCorp'); db.add(c); db.commit(); u=models.User(username='admin', password_hash=h, role='admin', company_id=1); db.add(u); db.commit();"

echo "Database is clean and Admin (admin/password123) is ready!"