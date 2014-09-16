Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc3/doc/">App SDK 2.0rc3 Docs</a>'},
    _story : {},
    _defect : {},
    _type : null,
    launch: function() {
        Ext.create('Rally.ui.dialog.ChooserDialog', {
            width: 450,
            autoScroll: true,
            height: 525,
            title: 'Select a Defect',
            pageSize: 100,
            closable: false,
            selectionButtonText: 'Copy',                  
            artifactTypes: ['Defect'],
            autoShow: true,
            storeConfig:{
                fetch: ['Name','ScheduleState','State','Priority','Severity','Tasks']
            },
            listeners: {
                artifactChosen: function(selectedRecord) {
                    console.log(selectedRecord.get('FormattedID') + ', ' + selectedRecord.get('Name') + ' was chosen');
                    this._story = selectedRecord;
                    this._defect = selectedRecord;
                    this.getStoryModel();
                },
                scope: this
            },
        }); 
    },
     getStoryModel: function() {
        Rally.data.ModelFactory.getModel({
            type: 'UserStory',
            success: this.onStoryModelRetrieved,
            scope: this
        });     
    },      
    onStoryModelRetrieved: function(model) {
        this.storyModel = model;
        this.createStory();
    },

    createStory: function() {
        var that = this;
        var record = Ext.create(this.storyModel, {
            Name: this._story.get('Name'),
            ScheduleState: this._story.get('ScheduleState'),
            Notes: '<b>Defect specific properties:</b><br>Defect State: Closed<br>Priority:' + this._story.get('Priority') + '<br>Severity:' + this._story.get('Severity') 
            
        });
        record.save({
            callback: function(result, operation) {
                if(operation.wasSuccessful()) {
                    that._storyOid = result.get('ObjectID');
                    console.log('created story:', that._storyOid, result.get('FormattedID'),result.get('Name'),result.get('ScheduleState'));
                    that.getDefectModel();
                }
                else{
                    console.log("error");
                }
            }
        });
    },
    getDefectModel:function(){
        console.log('closing defect ' + this._defect.get('FormattedID'));
        Rally.data.ModelFactory.getModel({
            type: 'defect',
            success: this.onDefectModelRetrieved,
            scope: this
        });     
    },
    onDefectModelRetrieved: function(model) {
        this.defectModel = model;
        this.closeDefect();
    },
    closeDefect:function(){
        var that = this;
        that._tasks = [];
        var defectOid = that._defect.get('ObjectID');
        this.defectModel.load(defectOid, {
            fetch: ['State','Tasks'],
            callback: function(record, operation) {
                if (record.get('Tasks').Count > 0) {
                    console.log(record.get('Tasks').Count + ' tasks will be moved from the defect to the story:');
                    var tasksOfDefect = record.getCollection('Tasks');
                    tasksOfDefect.load({
                        callback: function(taskRecords, operation, success) {
                            _.each(taskRecords, function(taskRecord){
                                var ref = taskRecord.get('_ref');
                                that._tasks.push(ref);
                                tasksOfDefect.remove({'_ref':ref});
                                console.log('removed', ref)
                            });
                            tasksOfDefect.sync({
                                callback: function() {
                                    console.log('succcess')
                                }
                            });
                            record.set('State','Closed');
                            record.save({
                                callback: function(record, operation) {
                                    if(operation.wasSuccessful()) {
                                        console.log('defect state after update:', record.get('State'));
                                        that.updateTasksOnStory();
                                    }
                                    else{
                                        console.log("?");
                                    }
                                }
                             }); 
                        }
                    });
                }
            }
        });
    },
    updateTasksOnStory:function(){
        var that = this;
        console.log('that._tasks', that._tasks);
        that.storyModel.load(that._storyOid, {
            fetch: ['FormattedID','Tasks'],
            callback: function(record, operation) {
                console.log('these tasks will be added to the story', record.get('FormattedID'), record);
                var tasksOfStory = record.getCollection('Tasks', {
                autoLoad: true,
                listeners: { load: function() {
                    _.each(that._tasks, function(ref){
                        tasksOfStory.add({'_ref' : ref});
                        console.log('added', ref);
                    });
                    tasksOfStory.sync({
                        callback: function() {
                            console.log('success');
                        }
                    });
                }}
            });    
            }
        });
    }
});