variable "kubeconfig_path" {
  description = "Ruta al archivo kubeconfig para conectarse al cluster"
  type        = string
  default     = "~/.kube/config"
}

variable "namespace" {
  description = "Namespace donde se desplegará la app"
  type        = string
  default     = "unas-tasks"
}

variable "task_web_image" {
  description = "Imagen Docker de task-web (Task-API)"
  type        = string
  # ejemplo: "123456789012.dkr.ecr.us-east-1.amazonaws.com/task-web:latest"
}

variable "db_user" {
  type        = string
  default     = "tevis"
}

variable "db_password" {
  type        = string
  default     = "tevis123!"
}

variable "db_name" {
  type        = string
  default     = "fiis_development"
}

variable "jwt_secret" {
  type        = string
  default     = "super-secret-demo"
}

variable "jwt_expires_in" {
  type        = string
  default     = "15m"
}
