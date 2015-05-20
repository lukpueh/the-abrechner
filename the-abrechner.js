Abrechnungs = new Mongo.Collection("abrechnungs");
Persons = new Mongo.Collection("persons");
Items = new Mongo.Collection("items");

Router.configure({
    layoutTemplate: 'main'
});
Router.map(function(){
    this.route('home', {path: '/'} );
    this.route('abrechner', {
        path: '/:link',
        data: function() {
            var link = this.params.link;
            Session.set("link", link);
            var abrechnung = Abrechnungs.findOne({"link": link});
            return abrechnung;
        }
    });
});

if (Meteor.isClient) {
    Tracker.autorun(function () {
        var link = Session.get("link");
        if (typeof link != 'undefined' && link != null) {
            Meteor.subscribe("abrechnungs", link);
            Meteor.subscribe("items", link);
            Meteor.subscribe("persons", link);
        }
    });

    Template.home.events({
        "submit .new-abrechner": function(event) {
            var title = event.target.title.value;
            var description = event.target.description.value;
            Meteor.call("addAbrechner", title, description, function(err, link){
                Router.go('abrechner', {"link": link});
            });
            return false;
        }
    });

    // Draw pie if container rendered for the first time
    Template.abrechner.onRendered(function(){
        var paper = Raphael("raphael-container");
        Tracker.autorun(function(){
            var items = Items.find().fetch();
            paper.clear();
            var totalAmounts = [];
            var totalItems = [];
            items.forEach(function(item){
                totalAmounts.push(item.amount);
                totalItems.push(item.title + " - %%.%%");
            });
            var chart = paper.piechart(150, 150, 100, totalAmounts, {
                legend: totalItems, 
                legendegendpos: "east", 
            });  
        });
    });

    Template.abrechner.helpers({
        personsForAbrechnung: function(){
            return Persons.find();
        },
        itemsForAbrechnung: function(){
            return Items.find();
        },
        hasPersons: function() {
            if (! Persons.find().count())
                return "hidden";
        },
        hasItems: function() {
            if (! Items.find().count())
                return "hidden";
        },
        personNameById: function(personId) {
            var person = Persons.findOne(personId);
            if (person)
               return person.name;
            return "Nobody";
        },
        sum: function(){
            var sum = 0;
            Items.find().forEach(function(item){
                sum += item.amount;
            });
            return sum;
        },
        /*
         * Return an array with all involved persons specifying 
         * who paid what and who has to pay what.
         */
        breakDown: function() {
            //Create an associative array for all involved persons, personId is Key
            var persons = new Array(); 
            Persons.find().forEach(function(person) {
               return persons[person._id] = { "name": person.name, "paid": 0, "pays": 0};
            });

            //Go through all items and fill persons Array
            Items.find().forEach(function(item){
                //Add paid amount to paying person
                persons[item.paidBy].paid += item.amount;

                //Check how many persons want to pay and divide 
                var divider = 0;
                item.shares.forEach(function(share){
                    if (share.pays)
                        divider += 1;
                });
                var absShare = 0;
                if (divider > 0)
                    absShare = item.amount / divider;

                //Add pays amount to all persons
                item.shares.forEach(function(share){
                    if (share.pays)
                        persons[share.person].pays += absShare;
                });
            });
            var result = new Array();
            Object.keys(persons).forEach( function(key) { 
                result.push({"name": persons[key].name, 
                             "paid": persons[key].paid, 
                             "pays": persons[key].pays,
                             "diff": (persons[key].paid - persons[key].pays)});
             });
            return result;
        },

    });

    Template.abrechner.events({
        // Add new Person
        "submit .new-person": function (event) {
            var link = Session.get("link");
            var name = event.target.person.value;
            Meteor.call("addPerson", link, name);
            
            event.target.person.value = "";
            return false;
        },
        "click .delete-person": function () {
            var link = Session.get("link");
            var personId = this._id;
            if (Items.find({"paidBy" : personId}).count() > 0){
                alert("Hey he has already paid");
                return false;
            }
            Meteor.call("removePerson", link, personId);
        },
        // Add new item
        "submit .new-item": function (event) {
            var link = Session.get("link");
            var title = event.target.item.value;
            var amount = parseInt(event.target.amount.value);
            var personId = event.target.person.value;

            Meteor.call("addItem", link, title, amount, personId);
            
            event.target.item.value = "";
            event.target.amount.value = "";
            return false;
        },
        "click .delete-item": function () {
            var link = Session.get("link");
            var itemId = this._id;
            Meteor.call("removeItem", link, itemId);
        },

        "change .pays-share": function(event) {
            var link = Session.get("link");
            var itemId = $(event.target).data("item-id");
            var personId = this.person;
            var checked = event.target.checked;

            Meteor.call("updateShare",link, itemId, personId, checked);
        },
        "click .delete-abrechnung": function(event) {
            var link = Session.get("link");
            var abrechnungsId = this._id;
            Meteor.call("removeAbrechnung", link, abrechnungsId);
            Router.go('home');
        }
    });
}

if (Meteor.isServer) {

    Meteor.publish("abrechnungs", function (link) {
        return Abrechnungs.find({"link": link});
    });
    Meteor.publish("items", function (link) {
        return Items.find({"link": link});
    });
    Meteor.publish("persons", function (link) {
        return Persons.find({"link": link});
    });
}

Meteor.methods({
    /*
     * Create a hash5 link based on current Time and a random int
     * For collision should be tested
     */
    _createLink: function() {
        //Link must be unique!!
        do {
            var rand = new Date().getTime().toString() + Math.floor(Math.random() * 10000 + 1).toString();
            var hash = CryptoJS.MD5(rand);
            var link = hash.toString();
        } while(Abrechnungs.find({"link" : link}).count() > 0)

        return link;
    },
    addAbrechner: function(title, description) {

        var link =  Meteor.call("_createLink");
        Abrechnungs.insert({"title": title, "description": description, "link": link, createdAt: new Date()});
        return link;
    },
    addPerson: function(link, name){
        var personId = Persons.insert({"link": link, "name": name})
        Items.update(
            {"link": link},
            {$push: {
                "shares" : { 
                    "person": personId, "pays" : true 
                }}}, {multi: true})
    },
    removePerson: function(link, personId) {
        Items.update({"link": link}, {$pull: {"shares" : {"person" : personId}}}, {multi: true});
        Persons.remove(personId);
    },
    addItem: function(link, title, amount, personId) {
        //Create share array for all existing persons

        var shares = Persons.find({"link": link}).map(function(p){
                                        return {
                                                person: p._id, 
                                                pays: true
                                            }
                                    });
        Items.insert({"link": link,                         
                      "title"  : title, 
                      "amount" : amount, 
                      "paidBy" : personId, 
                      "shares" : shares })
    },
    removeItem: function(link, itemId) {
        Items.remove({"_id": itemId, "link": link});
    },
    updateShare: function (link, itemId, personId, pays) {
        Items.update({
            "_id" : itemId, 
            "link": link,
            "shares.person": personId
        }, {$set: {"shares.$.pays": pays}});
    },
    removeAbrechnung: function(link, abrechnungsId) {
        Items.remove({"link": link});
        Persons.remove({"link": link});
        Abrechnungs.remove({"_id": abrechnungsId, "link": link});
    }
});
