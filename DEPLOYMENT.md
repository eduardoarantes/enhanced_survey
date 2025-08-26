# 🐳 Enhanced Survey Tool - AWS EC2 Deployment Guide

This guide will help you deploy the Enhanced Survey Tool on your AWS EC2 instance using Docker Compose.

## 📋 Prerequisites

- AWS EC2 instance running (any size, t2.micro works fine)
- Docker and Docker Compose installed on EC2
- Your Google Gemini API key (required)
- OpenAI API key (optional, for ChatGPT model)

## 🚀 Quick Deployment Steps

### 1. Install Docker on EC2 (if not already installed)

```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for docker group to take effect
exit
```

### 2. Upload Project Files

Upload the entire `enhanced_survey` folder to your EC2 instance:

```bash
# Option 1: Using scp from your local machine
scp -r -i your-key.pem enhanced_survey/ ec2-user@your-ec2-ip:~/

# Option 2: Using git (if you have a repository)
git clone your-repo-url
cd enhanced_survey
```

### 3. Configure Environment Variables

```bash
# Copy the environment template
cp .env.production .env

# Edit the .env file with your API keys
nano .env
```

Update with your actual API keys:
```env
# Google Gemini API Key (required - default model)
GOOGLE_API_KEY=your_actual_google_gemini_api_key

# OpenAI API Key (optional)
OPENAI_API_KEY=your_actual_openai_api_key
```

### 4. Deploy with Docker Compose

```bash
# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 5. Configure EC2 Security Group

Ensure your EC2 security group allows:
- **HTTP (Port 80)**: Inbound from 0.0.0.0/0
- **SSH (Port 22)**: Inbound from your IP

## 🌐 Accessing Your Application

Once deployed, access your survey tool at:
```
http://your-ec2-public-ip
```

## 📊 Service Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Internet      │───▶│   Frontend       │───▶│   Backend       │
│   (Port 80)     │    │   (Nginx)        │    │   (Node.js)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                       │
                                │                       ▼
                                │               ┌─────────────────┐
                                │               │  Persistent     │
                                │               │  Storage        │
                                │               │  (LLM Prompts)  │
                                │               └─────────────────┘
                                ▼
                       ┌─────────────────┐
                       │   Static Files  │
                       │   (React App)   │
                       └─────────────────┘
```

## 🔧 Management Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Update Application
```bash
# Pull latest changes (if using git)
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Backup Data
```bash
# Backup LLM prompt data
docker cp survey-backend:/app/data ./backup-data/
```

### Scale Services (if needed)
```bash
# Scale backend (not typically needed for this app)
docker-compose up -d --scale backend=2
```

## 🐛 Troubleshooting

### Check Container Health
```bash
# View container status
docker-compose ps

# Check health status
docker-compose exec backend curl http://localhost:3001/health
docker-compose exec frontend wget -O- http://localhost/
```

### Common Issues

**1. Application not accessible:**
- Check EC2 security group allows port 80
- Verify containers are running: `docker-compose ps`

**2. API errors in browser:**
- Check backend logs: `docker-compose logs backend`
- Verify API keys are correct in `.env` file

**3. Build failures:**
- Ensure Docker has enough disk space: `df -h`
- Clear Docker cache: `docker system prune -a`

**4. LLM prompt not saving:**
- Check volume mount: `docker volume inspect enhanced_survey_survey_data`
- Verify container permissions: `docker-compose exec backend ls -la /app/data`

## 🔒 Security Considerations

1. **API Keys**: Never commit real API keys to version control
2. **Firewall**: Only allow necessary ports (80, 22)
3. **Updates**: Regularly update Docker images and system packages
4. **SSL/TLS**: Consider adding HTTPS with Let's Encrypt for production

## 📈 Performance Tips

1. **Resource Monitoring**:
```bash
# Monitor resource usage
docker stats

# EC2 monitoring
top
free -h
df -h
```

2. **Log Rotation**: Configure log rotation to prevent disk space issues
```bash
# Add to docker-compose.yml under each service:
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## 🎯 Production Enhancements

For production use, consider:
- SSL certificate (Let's Encrypt + Nginx)
- Domain name setup
- Database for survey responses (PostgreSQL)
- Redis for session storage
- Load balancer for high availability
- CloudWatch monitoring
- Automated backups

## ✅ Verification Checklist

- [ ] EC2 instance accessible via SSH
- [ ] Docker and Docker Compose installed
- [ ] Project files uploaded
- [ ] Environment variables configured
- [ ] Security group allows port 80
- [ ] Containers running: `docker-compose ps`
- [ ] Application accessible at `http://your-ec2-ip`
- [ ] LLM validation working (test with a survey)
- [ ] Prompt editing saves to file
- [ ] Logs showing no errors

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs`
3. Verify all configuration files are correct
4. Ensure your EC2 instance has sufficient resources

---

**🎉 Congratulations!** Your Enhanced Survey Tool is now deployed on AWS EC2!

Access it at: `http://your-ec2-public-ip`