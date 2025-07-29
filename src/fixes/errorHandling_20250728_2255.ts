// Bug fix: Enhanced error handling for image search
// Date: 2025-07-28 22:55

export interface SearchError {
  code: string;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export class ImageSearchErrorHandler {
  private static errorLog: SearchError[] = [];
  
  public static handleSearchError(
    error: Error, 
    searchQuery: string,
    context?: Record<string, any>
  ): SearchError {
    const searchError: SearchError = {
errorCode: this.generateErrorCode(error),
errorMessage: this.sanitizeErrorMessage(error.message),
timestamp: new Date(),
      context: { searchQuery, ...context }
    };
    
    this.errorLog.push(searchError);
    this.logError(searchError);
    
    return searchError;
  }
  
  private static generateErrorCode(error: Error): string {
    const hash = this.simpleHash(error.stack || error.message);
    return `IMG_SEARCH_${hash.substr(0, 8).toUpperCase()}`;
  }
  
  private static sanitizeErrorMessage(message: string): string {
    // Remove sensitive information from error messages
    return message
      .replace(/api[_-]?key[s]?[=:]\s*[\w-]+/gi, 'api_key=***')
      .replace(/token[s]?[=:]\s*[\w-]+/gi, 'token=***')
      .replace(/password[s]?[=:]\s*[\w-]+/gi, 'password=***');
  }
  
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
  
  private static logError(error: SearchError): void {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ImageSearch Error]', error);
    }
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(error);
    }
  }
  
  private static async sendToMonitoring(error: SearchError): Promise<void> {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      });
    } catch (monitoringError) {
      console.error('Failed to send error to monitoring:', monitoringError);
    }
  }
  
  public static getErrorStats(): { total: number; recent: SearchError[] } {
    const recentErrors = this.errorLog.filter(
      error => Date.now() - error.timestamp.getTime() < 24 * 60 * 60 * 1000
    );
    
    return {
      total: this.errorLog.length,
      recent: recentErrors
    };
  }
}

// Fix for memory leak in image cache
export class ImageCacheManager {
  private cache = new Map<string, string>();
  private readonly maxSize = 100;
  private accessOrder = new Map<string, number>();
  
  public set(key: string, imageUrl: string): void {
    // Implement LRU eviction to prevent memory leaks
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }
    
    this.cache.set(key, imageUrl);
    this.accessOrder.set(key, Date.now());
  }
  
  public get(key: string): string | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.accessOrder.set(key, Date.now());
    }
    return value;
  }
  
  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }
  
  public clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
  }
  
  public getStats(): { size: number; maxSize: number; hitRate: number } {
    // Implementation would track hit/miss ratio
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0.85 // Placeholder - would be calculated from actual usage
    };
  }
}
