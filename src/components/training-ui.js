// training-ui.js
export class TrainingUI {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'training-ui';
    this.container.style.position = 'fixed';
    this.container.style.top = '20px';
    this.container.style.right = '20px';
    this.container.style.color = 'white';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.container.style.padding = '10px';
    this.container.style.borderRadius = '5px';
    this.container.style.fontFamily = 'Arial, sans-serif';
    this.container.style.zIndex = '1000';
    
    this.progressElement = document.createElement('div');
    this.episodeElement = document.createElement('div');
    this.distanceElement = document.createElement('div');
    
    this.container.appendChild(this.progressElement);
    this.container.appendChild(this.episodeElement);
    this.container.appendChild(this.distanceElement);
    
    document.body.appendChild(this.container);
    
    this.updateProgress(0, 0);
    this.updateDistance('--');
  }
  
  updateProgress(completion, episode) {
    this.progressElement.textContent = `Exploration: ${(completion * 100).toFixed(1)}%`;
    this.episodeElement.textContent = `Episode: ${episode}`;
  }

    updateDistance(distance) {
    this.distanceElement.textContent = `Goal distance: ${distance} m`;

        // Color coding based on distance
    if (distance !== '--') {
      const distNum = parseFloat(distance);
      if (distNum < 10) {
        this.distanceElement.style.color = '#00ff00';
        this.distanceElement.style.fontWeight = 'bold';
      } else if (distNum < 20) {
        this.distanceElement.style.color = '#ffff00';
        this.distanceElement.style.fontWeight = 'normal';
      } else {
        this.distanceElement.style.color = 'white';
        this.distanceElement.style.fontWeight = 'normal';
      }
    } else {
      this.distanceElement.style.color = 'white';
      this.distanceElement.style.fontWeight = 'normal';
    }
  }
  
  showMessage(message, duration = 2000) {
    const messageElement = document.createElement('div');
    messageElement.style.position = 'fixed';
    messageElement.style.top = '50%';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translate(-50%, -50%)';
    messageElement.style.color = 'white';
    messageElement.style.fontSize = '24px';
    messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    messageElement.style.padding = '20px';
    messageElement.style.borderRadius = '10px';
    messageElement.style.zIndex = '10000';
    messageElement.textContent = message;
    
    document.body.appendChild(messageElement);
    
    setTimeout(() => {
      document.body.removeChild(messageElement);
    }, duration);
  }
}