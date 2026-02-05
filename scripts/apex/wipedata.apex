// 1) Delete child custom objects first
delete [SELECT Id FROM Project_Task__c];
delete [SELECT Id FROM Project__c];

// 2) Delete child standard objects
delete [SELECT Id FROM Case];
delete [SELECT Id FROM Opportunity];
delete [SELECT Id FROM Contact];

// 3) Delete parent Account records
delete [SELECT Id FROM Account];
