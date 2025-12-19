@IsTest
private class LRES_HierarchyExplorerControllerTest {
  private static final String TEMPLATE_NAME = 'Accounts_Contacts_Cases';

  @IsTest
  static void testRootObjectNotInTemplateThrows() {
    assertTemplateConfigured();

    Opportunity opportunity = new Opportunity(
      Name = 'Opp',
      StageName = 'Prospecting',
      CloseDate = Date.today()
    );
    insert opportunity;

    Test.startTest();
    try {
      LRES_HierarchyExplorerController.getHierarchy(
        TEMPLATE_NAME,
        opportunity.Id,
        10,
        50
      );
      System.assert(
        false,
        'Expected an exception due to root object not appearing in the template.'
      );
    } catch (AuraHandledException ex) {
      System.assert(
        ex.getMessage().contains('does not appear'),
        'Expected missing-object placement error. Actual: ' + ex.getMessage()
      );
    }
    Test.stopTest();
  }

  @IsTest
  static void testUniqueRootPlacementReturnsHierarchy() {
    assertTemplateConfigured();

    Account parentAccount = new Account(Name = 'Parent');
    insert parentAccount;
    Contact contact = new Contact(
      LastName = 'Contact',
      FirstName = 'Test',
      Email = 'contact@example.com',
      AccountId = parentAccount.Id
    );
    insert contact;
    Case caseRecord = new Case(
      Subject = 'Test Case',
      Origin = 'Phone',
      Priority = 'Medium',
      ContactId = contact.Id
    );
    insert caseRecord;

    Test.startTest();
    LRES_HierarchyExplorerDtos.HierarchyResponseDto response = LRES_HierarchyExplorerController.getHierarchy(
      TEMPLATE_NAME,
      parentAccount.Id,
      10,
      50
    );
    Test.stopTest();

    System.assertNotEquals(null, response, 'Response should not be null.');
    System.assertEquals(
      false,
      response.capped,
      'Should not be capped for small trees.'
    );
    System.assertEquals(
      3,
      response.nodes.size(),
      'Expected account + contact + case nodes.'
    );
    System.assertEquals(
      2,
      response.edges.size(),
      'Expected edges Account->Contact and Contact->Case.'
    );
  }

  @IsTest
  static void testCappingSetsFlag() {
    assertTemplateConfigured();

    Account parentAccount = new Account(Name = 'Parent');
    insert parentAccount;

    List<Contact> contacts = new List<Contact>();
    for (Integer i = 0; i < 60; i += 1) {
      contacts.add(
        new Contact(LastName = 'Contact ' + i, AccountId = parentAccount.Id)
      );
    }
    insert contacts;

    Test.startTest();
    LRES_HierarchyExplorerDtos.HierarchyResponseDto response = LRES_HierarchyExplorerController.getHierarchy(
      TEMPLATE_NAME,
      parentAccount.Id,
      10,
      50
    );
    Test.stopTest();

    System.assertEquals(
      true,
      response.capped,
      'Should be capped when nodes exceed max.'
    );
    System.assertEquals(
      50,
      response.nodes.size(),
      'Should only return up to 50 nodes.'
    );
    System.assertNotEquals(
      null,
      response.capMessage,
      'Cap message should be populated.'
    );
  }

  @IsTest
  static void testRootPlacementValidatesDescendantsBeforeAccepting() {
    // Simulate a template configuration where the descendant traversal is invalid.
    // This should be rejected during root placement inference (plan said validate up and down),
    // rather than failing later during descendant fetch.
    LRES_HierarchyTemplateService.LevelConfig level1 = new LRES_HierarchyTemplateService.LevelConfig();
    level1.levelNumber = 1;
    level1.objectApiName = 'Account';
    level1.childObjectApiName = 'Contact';
    level1.childRelationshipName = 'BogusRelationshipName';
    level1.cardFieldApiNames = new List<String>{ 'Name' };
    level1.cardFieldIcons = new List<String>();

    LRES_HierarchyTemplateService.LevelConfig level2 = new LRES_HierarchyTemplateService.LevelConfig();
    level2.levelNumber = 2;
    level2.objectApiName = 'Contact';
    level2.childObjectApiName = null;
    level2.childRelationshipName = null;
    level2.cardFieldApiNames = new List<String>{ 'Name' };
    level2.cardFieldIcons = new List<String>();

    Test.startTest();
    try {
      Integer rootLevel = LRES_HierarchyExplorerController.inferRootLevelNumberForTest(
        Id.valueOf('001000000000001AAA'),
        new List<LRES_HierarchyTemplateService.LevelConfig>{ level1, level2 }
      );
      System.assertEquals(
        null,
        rootLevel,
        'Expected placement inference to throw for invalid descendants.'
      );
      System.assert(
        false,
        'Expected an exception due to invalid descendant traversal.'
      );
    } catch (AuraHandledException ex) {
      System.assert(
        ex.getMessage().contains('Unable to place Root Record Id'),
        'Unexpected message: ' + ex.getMessage()
      );
    }
    Test.stopTest();
  }

  private static void assertTemplateConfigured() {
    System.assertEquals(
      1,
      [
        SELECT COUNT()
        FROM LRES_Hierarchy_Template__mdt
        WHERE DeveloperName = :TEMPLATE_NAME AND Active__c = TRUE
      ],
      'Expected Custom Metadata template ' +
        TEMPLATE_NAME +
        ' to exist and be active.'
    );
    System.assert(
      [
        SELECT COUNT()
        FROM LRES_Hierarchy_Template_Level__mdt
        WHERE Hierarchy_Template__r.DeveloperName = :TEMPLATE_NAME
      ] > 0,
      'Expected Custom Metadata levels to exist for template ' +
        TEMPLATE_NAME +
        '.'
    );
  }
}
