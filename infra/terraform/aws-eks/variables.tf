variable "region" {
  description = "Región de AWS"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "Nombre del cluster EKS"
  type        = string
  default     = "unas-tasks-eks"
}

# Asumimos VPC existente (puedes cambiar esto si quieres que Terraform también la cree)
variable "vpc_id" {
  description = "ID de la VPC existente"
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs de subnets privadas para los nodos EKS"
  type        = list(string)
}

variable "namespace" {
  description = "Namespace para la aplicación"
  type        = string
  default     = "unas-tasks"
}

variable "task_web_image" {
  description = "Imagen Docker de task-web (Task-API). Ej: tuusuario/task-web:latest"
  type        = string
}

# DB
variable "db_user" {
  type    = string
  default = "tevis"
}

variable "db_password" {
  type    = string
  default = "tevis123!"
}

variable "db_name" {
  type    = string
  default = "fiis_development"
}

# JWT
variable "jwt_secret" {
  type    = string
  default = "super-secret-demo"
}

variable "jwt_expires_in" {
  type    = string
  default = "15m"
}
