/**
 * FileUploader.js
 *
 * Copyright 2015, Moxiecode Systems AB
 * Released under GPL License.
 *
 * License: http://www.plupload.com/license
 * Contributing: http://www.plupload.com/contributing
 */

/**
 * @class plupload/FileUploader
 * @constructor 
 * @private 
 * @extends plupload/core/QueueItem
 */
define('plupload/FileUploader', [
	'plupload',
    'plupload/core/Collection',
	'plupload/core/QueueItem',
	'plupload/UploadingQueue',
	'plupload/ChunkUploader'
], function(plupload, Collection, QueueItem, UploadingQueue, ChunkUploader) {
    
    var dispatches = [
        
    ];
   
    function FileUploader(fileRef, options) {
       var _options;
       var _file = fileRef;
       var _offset = 0;
       var _chunks = new Collection();
       
       var _queue = UploadingQueue.getInstance();
       
		_options = plupload.extendIf({
			url: false,
			chunk_size: 0,
			multipart: true,
			http_method: 'POST',
			params: {},
			headers: false,
			file_data_name: 'file',
			send_file_name: true,
			stop_on_fail: true
		}, options);
		
		
		FileUploader.prototype.init.call(this, _options);
       
        plupload.extend(this,  {
            
            uid: plupload.guid(),
            
            start: function(options) {
            	var self = this;
            	var up;
            	
            	FileUploader.prototype.start.call(self);
            	
            	if (options) {
            		plupload.extend(_options, options);
            	}

            	if (_options.chunk_size) {
					self.uploadChunk(false, false, true);
            	} else {
            		up = new ChunkUploader(_file, _options);
				
					up.bind('progress', function(e) {
						self.progress(e.loaded, e.total);
			        });
	        		
					up.bind('done', function(e, result) {
						self.done(result);
						this.destroy();
					});
					
					up.bind('failed', function(e, result) {
						self.failed(result);
						this.destroy();
					});
					
					_queue.addItem(up);
            	}
            },


            getFile: function() {
            	return fileRef;
            },
            
            
            uploadChunk: function(seq, options, dontStop) {
        		var self = this;
            	var chunkSize;
        		var up;
        		var chunk;
        		
        		if (options) {
        			// chunk_size cannot be changed on the fly
        			delete options.chunk_size;
            		plupload.extend(_options, options);
            	}
            	
            	chunk.seq = parseInt(seq, 10) || Math.floor(_offset / chunkSize) + 1; // advance by one if undefined,
				chunk.start = chunk.seq * chunkSize;
				chunk.end = Math.max(chunk.start + chunkSize, _file.size);
				chunk.total	= _file.size;

				// do not proceed for weird chunks
				if (chunk.start < 0 || chunk.start >= _file.size) {
					return false;
				}
				
				
				up = ChunkUploader(_file.slice(chunk.start, chunk.end, _file.type), _options);
				
				up.bind('progress', function(e) {
					self.progress(calcProcessed() + e.processed, e.total);
		        });
		        
		        up.bind('failed', function(e, result) {
		        	_chunks.add(chunk.seq, plupload.extend({ state	: QueueItem.FAILED }, chunk));
		        	
		        	self.trigger('chunkuploadfailed', plupload.extend({}, chunk, result));
					
					if (_options.stop_on_fail) {
						self.failed(result);
					}
		        });
        		
				up.bind('done', function(e, result) {
					_chunks.add(chunk.seq, plupload.extend({ state	: QueueItem.DONE }, chunk));
					
					self.trigger('chunkuploaded', plupload.extend({}, chunk, result));
					
					if (calcProcessed() >= _file.size) {
						self.done(result); // obviously we are done
					} else if (dontStop) {
						plupload.delay.call(self, self.uploadChunk);
					}
					
					this.destroy();
				});
				
				up.bind('failed', function(e, result) {
					self.progress(calcProcessed());
					this.destroy();
				});
				
				
				_chunks.add(chunk.seq, plupload.extend({ state	: QueueItem.PROCESSING }, chunk));
				_queue.addItem(up);
				
				// enqueue even more chunks if slots available
				if (dontStop && _queue.countSpareSlots()) {
					self.uploadChunk();
				}
				
				return true;
            },
            
            
            destroy: function() {
            	FileUploader.prototype.destroy.call(this);
            	_queue = _file = null;
            }
        });
        
        
        function calcProcessed() {
        	var processed = 0;
        	
        	_chunks.each(function(item) {
        		if (item.state === QueueItem.DONE) {
    				processed += (item.end - item.start);
        		}
        	});
        	
        	return processed;
        }
       
   }
   
   
   plupload.extend(FileUploader, {
       /**
		File is queued for upload
		
		@property QUEUED
		@static
		@final
		*/
		QUEUED: 1,

		/**
		File is being uploaded
		
		@property UPLOADING
		@static
		@final
		*/
		UPLOADING: 2,

		/**
		File has failed to be uploaded
		
		@property FAILED
		@static
		@final
		*/
		FAILED: 4,

		/**
		File has been uploaded successfully
		
		@property DONE
		@static
		@final
		*/
		DONE: 5,

		/**
		File (Image) is being resized
		
		@property RESIZING
		@static
		@final
		*/
		RESIZING: 6,

		/**
		File is paused

		@property PAUSED
		@static
		@final
		*/
		PAUSED: 7
   });
   
   
   FileUploader.prototype = new QueueItem();
   
   return FileUploader;
});