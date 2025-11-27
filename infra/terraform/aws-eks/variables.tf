variable "region" {
  description = "Región AWS donde se creará el cluster EKS"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "Nombre del cluster EKS"
  type        = string
  default     = "unas-tasks-eks"
}

# Para simplificar, asumimos que ya tienes VPC y subnets creadas
variable "vpc_id" {
  description = "ID de la VPC existente"
  type        = string
}

variable "private_subnet_ids" {
  description = "Subnets privadas para los nodos"
  type        = list(string)
}
