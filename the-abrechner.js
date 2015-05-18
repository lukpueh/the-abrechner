Abrechnungs = new Mongo.Collection("abrechnungs");

Persons = new Mongo.Collection("persons");
Items = new Mongo.Collection("items");
Paper = null;

Router.map(function(){
    this.route('home', {path: '/'} );
    this.route('abrechner', {
        path: '/:link',
        data: function() {
            var link = this.params.link;
            return Abrechnungs.findOne({link: link});
        }
    });

});

if (Meteor.isClient) {
    /*
     * Create a hash5 link based on current Time and a random int
     * For collision should be tested
     */
    function createLink() {
        var rand = new Date().getTime().toString() + Math.floor(Math.random() * 10000 + 1).toString();
        var hash = CryptoJS.MD5(rand);
        return hash.toString();
    }


    // window.onload = function() {
    //     Paper = Raphael("raphael-container");
    // // };
    // var raph = function () {
    //         Paper = Raphael("raphael-container");

    //     Paper.clear();
    //     var totalAmounts = [];
    //     var totalItems = [];
    //     Items.find({}).forEach(function(item){

    //         totalAmounts.push(item.amount);
    //         totalItems.push(item.title + " - %%.%%");
    //     })
    //     var chart = Paper.piechart(150, 150, 100, totalAmounts, 
    //               { legend: totalItems, 
    //                 legendpos: "east", 
    //               });
    // };
    // Template.abrechner.rendered = raph;
    // Template.abrechner.destroyed = raph;
    
    Template.home.events({
        "submit .new-abrechner": function(event) {
            var title = event.target.title.value;
            var description = event.target.description.value;

            //Link must be unique!!
            do {
                var link = createLink();
            } while(Abrechnungs.find({"link" : link}).count() > 0)

            Abrechnungs.insert({title: title, description: description, link: link, createdAt: new Date()});
            Router.go('abrechner', {link: link});
            return false;
        }
    });    

    Template.abrechner.helpers({
        personsForAbrechnung: function(){
            return Persons.find({"abrechnung": this._id});
        },
        itemsForAbrechnung: function(){
            return Items.find({"abrechnung": this._id});
        },
        personNameById: function(personId) {
            var person = Persons.findOne(personId);
            if (person)
               return person.name;
            return "Nobody";
        }
    });

    Template.abrechner.events({
        // Add new Person
        "submit .new-person": function (event) {
            var name = event.target.person.value;
            Meteor.call("addPerson", this._id, name);
            
            event.target.person.value = "";
            return false;
        },
        "click .delete-person": function () {
            var personId = this._id;
            if (Items.find({"paidBy" : personId}).count() > 0){
                alert("Hey he has already paid");
                return false;
            }
            Meteor.call("removePerson", personId);
        },

        // Add new item
        "submit .new-item": function (event) {
            var title = event.target.item.value;
            var amount = parseInt(event.target.amount.value);
            var personId = event.target.person.value;

            Meteor.call("addItem", this._id, title, amount, personId);
            
            event.target.item.value = "";
            event.target.amount.value = "";
            return false;
        },
        "click .delete-item": function () {
            var itemId = this._id;
            Meteor.call("removeItem", itemId);
        },

        "change .pays-share": function(event) {
            var itemId = $(event.target).data("item-id");
            var personId = this.person;
            var checked = event.target.checked;

            Meteor.call("updateShare", itemId, personId, checked);
        },
        "click .delete-abrechnung": function(event) {
            var abrechnungsId = this._id;
            Meteor.call("removeAbrechnung", abrechnungsId);
            Router.go('home');
        }
    });

    // Template.share.helpers({
    //     person: function() {
    //         return Persons.findOne(this.person);
    //     }
    // });
    // Template.account.helpers({
    //     hasPaid: function() {
    //         var amount = 0;
    //         Items.find({paidBy : this._id}).forEach(function(item){amount += item.amount});
    //         return amount;
    //     },
    //     mustPay: function() {
    //         var amount = 0;
    //         var id = this._id;
    //         Items.find({}).forEach(function(item){
    //             item.shares.forEach(function(share){
    //                 if (share.person == id)
    //                     amount += share.amount;
    //             });
    //         });
    //         return amount;
    //     }
    // });
}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
    });
}


Meteor.methods({
    addPerson: function(abrechnungsId, name){
        var personId = new Mongo.ObjectID()._str;
        var personId = Persons.insert({"abrechnung": abrechnungsId, "name": name})
        Items.update(
            {"abrechnung": abrechnungsId},
            {$push: {
                "shares" : { 
                    "person": personId, "pays" : true 
                }}}, {multi: true})
    },
    removePerson: function(personId) {
        Items.update({}, {$pull: {"shares" : {"person" : personId}}}, {multi: true});
        Persons.remove(personId);
    },
    addItem: function(abrechnungsId, title, amount, personId) {
        //Create share array for all existing persons

        var shares = Persons.find({"abrechnung" : abrechnungsId}).map(function(p){
                                        return {
                                                person: p._id, 
                                                pays: true
                                            }
                                    });
        Items.insert({"abrechnung": abrechnungsId,                         
                        "title"  : title, 
                        "amount" : amount, 
                        "paidBy" : personId, 
                        "shares" : shares })
    },
    removeItem: function(itemId) {
        Items.remove(itemId);
    },
    updateShare: function (itemId, personId, pays) {
        Items.update({
            "_id" : itemId, 
            "shares.person": personId
        }, {$set: {"shares.$.pays": pays}});
    },
    removeAbrechnung: function(abrechnungsId) {
        Items.remove({"abrechnung": abrechnungsId});
        Persons.remove({"abrechnung": abrechnungsId});
        Abrechnungs.remove(abrechnungsId);
    }
});
