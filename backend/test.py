from passlib.hash import bcrypt

h = bcrypt.hash("test123")
print(h)

print(bcrypt.verify("test123", h))