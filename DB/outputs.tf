# 🔹 Outputs
output "rds_endpoint" {
  description = "Endpoint del RDS PostgreSQL de usuarios"
  value       = aws_db_instance.postgres.address
}

output "rds_sg_id" {
  description = "ID del Security Group del RDS de usuarios"
  value       = aws_security_group.rds_sg.id
}
