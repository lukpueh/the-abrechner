Persons = new Mongo.Collection("persons");
Items = new Mongo.Collection("items");
Paper = null;

if (Meteor.isClient) {

    // window.onload = function() {
    //     Paper = Raphael("raphael-container");
    // };
    // var raph = function () {
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
    // Template.item.rendered = raph;
    // Template.item.destroyed = raph;

    Template.body.helpers({
        persons: function () {
            return Persons.find();
        },
        items: function() {
            return Items.find();
        },
        getPersonName: function(id) {
            var person = Persons.findOne(id);
            if (person)
                return person.name;
            return "Nobody";
        }
    });

    Template.body.events({
        "submit .new-person": function (event) {
            var name = event.target.person.value;
            var personId = Persons.insert({name: name});
            //console.log(Items.find({"shares.person" : {$not: personId}}).fetch());
            Meteor.call("addSharePerson", personId);
            event.target.person.value = "";
            return false;
        },
        "click .delete-person": function () {
            var personId = this._id;
            if (Items.find({"paidBy" : personId}).count() > 0){
                alert("Hey he has already paid");
                return false;
            }
            Meteor.call("removeSharePerson", personId);
            Persons.remove(personId);
        },
        "submit .new-item": function (event) {
            var title = event.target.item.value;
            var amount = parseInt(event.target.amount.value);
            var personId = event.target.person.value;
            var shares = Persons.find().map(function(p){return {person: p._id, pays: true} });
            Items.insert({title: title, amount: amount, paidBy: personId, shares: shares });
            event.target.item.value = "";
            event.target.amount.value = "";
            return false;
        },
        "click .delete-item": function () {
            Items.remove(this._id);
        },
        "change .pays-share": function(event) {
            var itemId = $(event.target).data("parent-id");
            var personId = this.person;
            var checked = event.target.checked;

            Meteor.call("updateShare", itemId, personId, checked);
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
    updateShare: function (itemId, personId, pays) {
        Items.update({"_id" : itemId, "shares.person": personId}, {$set: {"shares.$.pays": pays}});
    },
    addSharePerson: function (personId) {
        Items.update({}, {$push: {"shares" : { "person": personId, "pays" : true }}}, {multi: true});
        // Items.update({"shares.person" : {$not: personId}}, {$push: {"shares" : { "person": personId, "pays" : true }}});
    },
    removeSharePerson: function (personId) {
        Items.update({}, {$pull: {"shares" : {"person" : personId}}}, {multi: true});
    }
});
