variable "aws_region" {
  description = "Región AWS donde se desplegará la infraestructura"
  default     = "us-east-1"
}

variable "vpc_id" {
  description = "VPC donde se desplegará el RDS"
  default     = "vpc-05cc965dd5f6593cf"
}

variable "private_subnets" {
  description = "Subredes donde se desplegará el RDS"
  type        = list(string)
  default     = [
    "subnet-090fc35d65175803c",
    "subnet-025b4dc78ddfafd2d"
  ]
}

variable "db_user" {
  description = "Usuario de la base de datos"
  default     = "postgres"
}

variable "db_password" {
  description = "Contraseña de la base de datos"
  default     = "Postgres#2025"
  sensitive   = true
}
