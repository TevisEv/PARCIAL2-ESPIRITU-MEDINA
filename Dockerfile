FROM node:20

# Directorio de trabajo
WORKDIR /app

# Opcional: nodemon global para desarrollo
RUN npm install -g nodemon

# Dependencias
COPY package*.json ./
RUN npm install

# Código
COPY . .

EXPOSE 3200

CMD ["npm", "run", "dev"]
