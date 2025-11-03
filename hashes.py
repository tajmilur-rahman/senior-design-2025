import bcrypt

admin_pw = "admin123"
admin_hash = bcrypt.hashpw(admin_pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
print("Admin hash:", admin_hash)

student_pw = "gannon2025"
student_hash = bcrypt.hashpw(student_pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
print("Student hash:", student_hash)